// normalize.ts - Line-ending normalization for composer input.

export function normalizeLineEndings(text: string): string {
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

export function normalizeForSend(text: string): string {
  let out = normalizeLineEndings(text);
  out = out.replace(/^\n+/, '').replace(/\n+$/, '');
  return out;
}
