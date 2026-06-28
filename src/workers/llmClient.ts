// Shared LLM client for worker threads.
// Anthropic-compatible /v1/messages API with SSE streaming + a
// non-streaming fallback. Used by the advisory worker (and safe to reuse
// elsewhere). Keep this dependency-free so it bundles cleanly into workers.

export interface LlmConfig {
  apiKey: string;
  apiBaseUrl: string; // e.g. "https://api.anthropic.com" or "/api/ai"
  model: string;
}

export interface CallOptions {
  onChunk?: (chunk: string) => void;
  system?: string;
  maxTokens?: number;
  temperature?: number;
  label?: string;      // for logging only
  timeoutMs?: number;  // idle timeout (no bytes / no response) before abort
}

// Idle timeout: aborts if no progress for this long. A long generation that
// keeps streaming tokens is fine; a stalled connection is not.
const DEFAULT_TIMEOUT_MS = 90_000;

function buildHeaders(config: LlmConfig): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-api-key': config.apiKey,
    'anthropic-version': '2023-06-01',
  };
  // Only needed for direct browser calls to the real Anthropic endpoint.
  if (config.apiBaseUrl.includes('anthropic.com')) {
    headers['anthropic-dangerous-direct-browser-access'] = 'true';
  }
  return headers;
}

function buildBody(prompt: string, config: LlmConfig, opts: CallOptions, stream: boolean) {
  const body: Record<string, unknown> = {
    model: config.model,
    max_tokens: opts.maxTokens ?? 8000,
    temperature: opts.temperature ?? 0,
    stream,
    messages: [{ role: 'user', content: prompt }],
  };
  if (opts.system) body.system = opts.system;
  return body;
}

/**
 * Call the model. Streams text deltas through opts.onChunk and returns the
 * full text. Has an idle timeout (aborts a stalled connection), surfaces
 * mid-stream error frames, and detects max_tokens truncation. Falls back to a
 * non-streaming request on transport/HTTP errors (but not on timeout/abort).
 */
export async function callLLM(
  prompt: string,
  config: LlmConfig,
  opts: CallOptions = {},
): Promise<string> {
  const url = `${config.apiBaseUrl}/v1/messages`;
  const label = opts.label ?? 'llm';
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  const controller = new AbortController();
  let timer = setTimeout(() => controller.abort(), timeoutMs);
  const resetIdle = () => {
    clearTimeout(timer);
    timer = setTimeout(() => controller.abort(), timeoutMs);
  };

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: buildHeaders(config),
      body: JSON.stringify(buildBody(prompt, config, opts, true)),
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timer);
    if (controller.signal.aborted) throw new Error(`${label} 请求超时`);
    console.warn(`[llm:${label}] streaming fetch failed, falling back:`, err);
    return callLLMNonStreaming(prompt, config, opts);
  }

  if (!response.ok) {
    clearTimeout(timer);
    const errorText = await response.text().catch(() => '');
    console.error(`[llm:${label}] HTTP ${response.status}`, errorText.slice(0, 300));
    return callLLMNonStreaming(prompt, config, opts);
  }

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('event-stream')) {
    clearTimeout(timer);
    // Server ignored stream=true and returned JSON.
    const data = await response.json();
    const text = data.content?.find((c: { type: string }) => c.type === 'text')?.text || '';
    opts.onChunk?.(text);
    return text;
  }

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let fullText = '';
  let buffer = '';
  let streamError: Error | null = null;
  let stopReason: string | null = null;

  const handleData = (data: string) => {
    if (!data || data === '[DONE]') return;
    let parsed: Record<string, unknown> & { delta?: Record<string, unknown>; error?: Record<string, unknown> };
    try {
      parsed = JSON.parse(data);
    } catch {
      return; // malformed chunk — skip
    }
    if (parsed.type === 'error') {
      const msg =
        (parsed.error?.message as string) || (parsed.error?.type as string) || '流式响应错误';
      streamError = new Error(msg);
      return;
    }
    if (parsed.type === 'message_delta' && parsed.delta?.stop_reason) {
      stopReason = parsed.delta.stop_reason as string;
      return;
    }
    if (parsed.type === 'content_block_delta') {
      const delta = parsed.delta;
      const t =
        delta?.type === 'text_delta' ? (delta.text as string) : !delta?.type ? (delta?.text as string) : undefined;
      if (t) {
        fullText += t;
        opts.onChunk?.(t);
      }
    }
  };

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      resetIdle();
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        const l = line.replace(/\r$/, '');
        // SSE spec: the single space after "data:" is optional.
        if (l.startsWith('data:')) handleData(l.slice(5).trim());
      }
      if (streamError) break;
    }
    const tail = buffer.replace(/\r$/, '');
    if (tail.startsWith('data:')) handleData(tail.slice(5).trim());
  } catch (err) {
    if (controller.signal.aborted) {
      clearTimeout(timer);
      throw new Error(`${label} 流式响应超时`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }

  if (streamError) throw streamError;
  if (stopReason === 'max_tokens' && !/\}\s*$/.test(fullText.trim())) {
    throw new Error(`${label} 响应被截断 (max_tokens)`);
  }
  return fullText;
}

/** Non-streaming request; simulates chunking so the UI still animates. */
export async function callLLMNonStreaming(
  prompt: string,
  config: LlmConfig,
  opts: CallOptions = {},
): Promise<string> {
  const url = `${config.apiBaseUrl}/v1/messages`;
  const label = opts.label ?? 'llm';
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? DEFAULT_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: buildHeaders(config),
      body: JSON.stringify(buildBody(prompt, config, opts, false)),
      signal: controller.signal,
    });
  } catch (err) {
    if (controller.signal.aborted) throw new Error(`${label} 请求超时`);
    throw err;
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(`API error ${response.status}: ${errorText.slice(0, 200)}`);
  }

  const data = await response.json();
  const text = data.content?.find((c: { type: string }) => c.type === 'text')?.text || '';

  if (opts.onChunk) {
    const chunkSize = 24;
    for (let i = 0; i < text.length; i += chunkSize) {
      opts.onChunk(text.slice(i, i + chunkSize));
    }
  }
  return text;
}

/** Find the index of the '}' that closes the '{' at `start`, or -1. */
function matchBrace(src: string, start: number): number {
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < src.length; i++) {
    const ch = src[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === '\\') esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/**
 * Best-effort repair of a truncated JSON object (e.g. a reasoning model that
 * ran out of max_tokens mid-answer). Closes a dangling string, drops a trailing
 * incomplete key/value, strips trailing commas, and balances open brackets so
 * the fields that DID complete can still be recovered.
 */
function repairTruncatedJson(src: string): string {
  let inStr = false;
  let esc = false;
  const stack: string[] = [];
  for (const ch of src) {
    if (inStr) {
      if (esc) esc = false;
      else if (ch === '\\') esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === '{') stack.push('}');
    else if (ch === '[') stack.push(']');
    else if (ch === '}' || ch === ']') stack.pop();
  }

  const hadDanglingString = inStr;
  let out = src;
  if (inStr) out += '"'; // close a dangling string
  out = out.replace(/,\s*$/, ''); // trailing comma
  out = out.replace(/,?\s*"[^"]*"\s*:\s*$/, ''); // dangling  "key":  (no value)
  // Only drop the trailing string if it was the one we just had to close —
  // a complete trailing string in an unclosed array should be kept.
  if (hadDanglingString) out = out.replace(/,\s*"[^"]*"$/, '');
  out = out.replace(/,\s*$/, '');
  while (stack.length) out += stack.pop();
  return out;
}

/**
 * Extract the first parseable JSON object from a model response. Tolerates
 * fenced code blocks, surrounding prose (even prose containing braces), and
 * trailing commas. As a last resort, repairs a truncated object so partial
 * results are still recoverable. Throws only if nothing usable is found.
 */
export function extractJsonObject(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const src = fenced ? fenced[1] : text;

  for (let s = src.indexOf('{'); s >= 0; s = src.indexOf('{', s + 1)) {
    const end = matchBrace(src, s);
    if (end < 0) break; // no balanced close from here on → truncated
    const candidate = src.slice(s, end + 1).replace(/,(\s*[}\]])/g, '$1');
    try {
      return JSON.parse(candidate);
    } catch {
      // not valid JSON (e.g. a "{A}" in prose) — try the next '{'
    }
  }

  // Salvage a truncated object.
  const first = src.indexOf('{');
  if (first >= 0) {
    try {
      return JSON.parse(repairTruncatedJson(src.slice(first)).replace(/,(\s*[}\]])/g, '$1'));
    } catch {
      /* unrecoverable */
    }
  }
  throw new Error('No parseable JSON object found in response');
}
