import { v4 as uuidv4 } from 'uuid';
import type { SourceDocument } from '../types';

/**
 * Client-side document ingestion.
 *
 * Extracts plain text from dropped files entirely in the browser:
 *   - text-like files (txt / md / json / csv / source code…) read directly
 *   - PDF via pdfjs-dist (dynamically imported)
 *   - Word .docx via mammoth (dynamically imported)
 *
 * Heavy parsers are loaded on demand so they never bloat the initial bundle.
 */

// Per-document character cap. Generous to exploit MiniMax-M3's 1M-token
// context — the worker enforces a combined cap across all docs (see MAX_DOC_CHARS).
export const MAX_CHARS_PER_DOC = 400_000;
// Reject files larger than this before reading them into memory (OOM guard).
export const MAX_FILE_BYTES = 50 * 1024 * 1024; // 50 MB

// Extensions we can read as UTF-8 text directly.
const TEXT_EXTENSIONS = new Set([
  'txt', 'md', 'markdown', 'mdx', 'rst', 'log',
  'json', 'jsonl', 'csv', 'tsv', 'yaml', 'yml', 'toml', 'ini', 'env', 'conf',
  'xml', 'html', 'htm', 'svg',
  'js', 'jsx', 'ts', 'tsx', 'mjs', 'cjs',
  'py', 'rb', 'go', 'rs', 'java', 'kt', 'kts', 'swift', 'c', 'h', 'cpp', 'cc', 'hpp',
  'cs', 'php', 'sh', 'bash', 'zsh', 'sql', 'r', 'lua', 'pl', 'scala', 'dart', 'vue', 'svelte',
  'css', 'scss', 'less', 'tex',
]);

const ACCEPTED_HINT = '.txt, .md, .json, .csv, 代码文件, .pdf, .docx';

export function getExtension(name: string): string {
  const idx = name.lastIndexOf('.');
  return idx >= 0 ? name.slice(idx + 1).toLowerCase() : '';
}

function isTextLike(file: File): boolean {
  const ext = getExtension(file.name);
  if (TEXT_EXTENSIONS.has(ext)) return true;
  // Trust text-ish mime types even when the extension is unusual.
  const mime = file.type;
  return (
    mime.startsWith('text/') ||
    mime === 'application/json' ||
    mime === 'application/xml' ||
    mime === 'application/javascript' ||
    mime === 'application/x-yaml'
  );
}

function formatBytes(bytes: number): string {
  return bytes < 1024 * 1024
    ? `${(bytes / 1024).toFixed(0)} KB`
    : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Decode a text file's bytes, honouring a BOM and falling back from UTF-8 to
 * GBK (very common for Chinese CSV/TXT exported from Excel/Windows) so we don't
 * silently store mojibake.
 */
function decodeText(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe)
    return new TextDecoder('utf-16le').decode(buf);
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff)
    return new TextDecoder('utf-16be').decode(buf);
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf)
    return new TextDecoder('utf-8').decode(buf);

  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buf);
  } catch {
    try {
      return new TextDecoder('gbk').decode(buf);
    } catch {
      return new TextDecoder('utf-8').decode(buf); // lossy last resort
    }
  }
}

/** Clip to the per-doc budget, flagging whether anything was dropped. */
function clip(text: string): { content: string; truncated: boolean } {
  // Collapse runs of 3+ blank lines but otherwise preserve the text verbatim.
  const normalized = text.replace(/\n{3,}/g, '\n\n').trim();
  if (normalized.length <= MAX_CHARS_PER_DOC) {
    return { content: normalized, truncated: false };
  }
  return {
    content:
      normalized.slice(0, MAX_CHARS_PER_DOC) +
      '\n\n…（文件过长，已截断，仅保留前 ' + MAX_CHARS_PER_DOC.toLocaleString() + ' 字符）',
    truncated: true,
  };
}

async function extractText(file: File): Promise<string> {
  return decodeText(await file.arrayBuffer());
}

async function extractPdf(file: File): Promise<string> {
  const pdfjs = await import('pdfjs-dist');
  // Wire up the worker (Vite resolves the ?url import to a hashed asset URL).
  const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

  const data = new Uint8Array(await file.arrayBuffer());
  const pdf = await pdfjs.getDocument({ data }).promise;
  const parts: string[] = [];
  let total = 0;
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item) => ('str' in item ? (item as { str: string }).str : ''))
      .join(' ');
    parts.push(pageText);
    total += pageText.length + 2;
    // Stop early once we've gathered well past the per-doc cap.
    if (total > MAX_CHARS_PER_DOC * 1.2) break;
  }
  await pdf.destroy().catch(() => {});
  return parts.join('\n\n');
}

async function extractDocx(file: File): Promise<string> {
  const mammoth = (await import('mammoth')).default;
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  return result.value;
}

/**
 * Ingest a single file into a SourceDocument. Never throws — extraction
 * failures are recorded on the returned document's `status`/`error`.
 */
export async function ingestFile(file: File): Promise<SourceDocument> {
  const base: SourceDocument = {
    id: uuidv4(),
    name: file.name,
    mime: file.type || getExtension(file.name) || 'unknown',
    size: file.size,
    content: '',
    charCount: 0,
    truncated: false,
    status: 'parsing',
  };

  const ext = getExtension(file.name);

  try {
    if (file.size > MAX_FILE_BYTES) {
      throw new Error(
        `文件过大（${formatBytes(file.size)}），上限 ${formatBytes(MAX_FILE_BYTES)}`,
      );
    }

    let raw: string;
    if (ext === 'pdf' || file.type === 'application/pdf') {
      raw = await extractPdf(file);
    } else if (ext === 'docx') {
      raw = await extractDocx(file);
    } else if (ext === 'doc') {
      throw new Error('旧版 .doc 暂不支持，请另存为 .docx 或 PDF');
    } else if (isTextLike(file)) {
      raw = await extractText(file);
    } else {
      throw new Error(`不支持的文件类型「${ext || file.type || '未知'}」，支持：${ACCEPTED_HINT}`);
    }

    if (!raw || !raw.trim()) {
      throw new Error('未能从文件中提取到任何文本内容');
    }

    const { content, truncated } = clip(raw);
    return {
      ...base,
      content,
      charCount: content.length,
      truncated,
      status: 'ready',
    };
  } catch (err) {
    return {
      ...base,
      status: 'error',
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export const ACCEPTED_FILE_HINT = ACCEPTED_HINT;
