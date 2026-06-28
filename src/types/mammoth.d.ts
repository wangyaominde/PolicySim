// Minimal ambient types for `mammoth` (the package ships no .d.ts).
// We only use the browser-side raw-text extraction path.
declare module 'mammoth' {
  interface ExtractResult {
    value: string;
    messages: unknown[];
  }
  interface MammothInput {
    arrayBuffer: ArrayBuffer;
  }
  export function extractRawText(input: MammothInput): Promise<ExtractResult>;
  const mammoth: {
    extractRawText(input: MammothInput): Promise<ExtractResult>;
  };
  export default mammoth;
}
