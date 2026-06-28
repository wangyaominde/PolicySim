import { useRef, useState, useCallback } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { motion, AnimatePresence } from 'framer-motion';
import type { SourceDocument } from '../../types';
import { ingestFile, getExtension, ACCEPTED_FILE_HINT } from '../../utils/fileIngest';

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const EXT_ICON: Record<string, string> = {
  pdf: '📕', docx: '📘', doc: '📘',
  md: '📝', markdown: '📝', txt: '📄',
  csv: '📊', tsv: '📊', xlsx: '📊',
  json: '🔧', yaml: '🔧', yml: '🔧',
};

function iconFor(name: string): string {
  return EXT_ICON[getExtension(name)] ?? '📄';
}

export default function FileDropzone({
  documents,
  setDocuments,
  disabled,
}: {
  documents: SourceDocument[];
  setDocuments: Dispatch<SetStateAction<SourceDocument[]>>;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleFiles = useCallback(
    (fileList: FileList | File[]) => {
      const files = Array.from(fileList);
      for (const file of files) {
        const id = uuidv4();
        const placeholder: SourceDocument = {
          id,
          name: file.name,
          mime: file.type || getExtension(file.name),
          size: file.size,
          content: '',
          charCount: 0,
          truncated: false,
          status: 'parsing',
        };
        setDocuments((prev) => [...prev, placeholder]);

        ingestFile(file).then((result) => {
          // Preserve our placeholder id so the entry updates in place.
          setDocuments((prev) =>
            prev.map((d) => (d.id === id ? { ...result, id } : d)),
          );
        });
      }
    },
    [setDocuments],
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      if (disabled) return;
      if (e.dataTransfer.files?.length) handleFiles(e.dataTransfer.files);
    },
    [disabled, handleFiles],
  );

  const removeDoc = (id: string) =>
    setDocuments((prev) => prev.filter((d) => d.id !== id));

  return (
    <div>
      {/* Dropzone */}
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled}
        aria-label="上传文件：点击选择或拖拽文件到此处"
        onClick={() => !disabled && inputRef.current?.click()}
        onKeyDown={(e) => {
          if (disabled) return;
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={(e) => {
          // Ignore dragleave events caused by moving onto a child element.
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false);
        }}
        onDrop={onDrop}
        className={`relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 ${
          dragging
            ? 'border-primary bg-primary/10'
            : 'border-surface-variant hover:border-primary/50 bg-surface-container-low'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <motion.span
          animate={dragging ? { scale: 1.15, y: -2 } : { scale: 1, y: 0 }}
          className="text-3xl mb-2"
        >
          📥
        </motion.span>
        <p className="text-sm font-medium text-on-surface">
          {dragging ? '松开以上传文件' : '拖拽文件到此处，或点击选择'}
        </p>
        <p className="mt-1 text-[11px] text-on-surface-variant/70">
          支持 {ACCEPTED_FILE_HINT}
        </p>
        <input
          ref={inputRef}
          type="file"
          multiple
          hidden
          accept=".txt,.md,.markdown,.json,.csv,.tsv,.yaml,.yml,.xml,.html,.pdf,.docx,.js,.ts,.tsx,.py,.go,.rs,.java,.c,.cpp,.cs,.sql,.sh"
          onChange={(e) => {
            if (e.target.files?.length) handleFiles(e.target.files);
            e.target.value = '';
          }}
        />
      </div>

      {/* Document list */}
      <AnimatePresence initial={false}>
        {documents.length > 0 && (
          <motion.ul
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-3 space-y-2"
          >
            {documents.map((doc) => (
              <motion.li
                key={doc.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -12 }}
                transition={{ duration: 0.2 }}
                className="flex items-center gap-3 rounded-lg bg-surface-container px-3 py-2"
              >
                <span className="text-lg shrink-0">{iconFor(doc.name)}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm text-on-surface font-medium">
                      {doc.name}
                    </span>
                    {doc.truncated && (
                      <span className="shrink-0 text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300">
                        已截断
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 text-[11px] text-on-surface-variant">
                    {doc.status === 'parsing' && (
                      <span className="text-primary animate-pulse">解析中…</span>
                    )}
                    {doc.status === 'ready' && (
                      <span>
                        {formatSize(doc.size)} · {doc.charCount.toLocaleString()} 字符
                      </span>
                    )}
                    {doc.status === 'error' && (
                      <span className="text-red-400">{doc.error || '解析失败'}</span>
                    )}
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeDoc(doc.id);
                  }}
                  className="shrink-0 flex h-6 w-6 items-center justify-center rounded-md text-on-surface-variant hover:bg-surface-container-high hover:text-red-400 transition-colors"
                  aria-label="移除文件"
                >
                  <span className="text-base leading-none">&times;</span>
                </button>
              </motion.li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
