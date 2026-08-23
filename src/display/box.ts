// box.ts - Plain line-drawing box helper.

/** Plain box with rounded borders: `width` is full box width, `pad` is inner padding. */
export function box(lines: string[], width: number, pad = 0): string {
  const inner = width - 2 - pad * 2;
  const body = lines.map((line) => {
    const text = line.length > inner ? line.slice(0, inner) : line.padEnd(inner);
    return `│${' '.repeat(pad)}${text}${' '.repeat(pad)}│`;
  });
  return [
    `╭${'─'.repeat(inner + pad * 2)}╮`,
    ...body,
    `╰${'─'.repeat(inner + pad * 2)}╯`,
  ].join('\n');
}
