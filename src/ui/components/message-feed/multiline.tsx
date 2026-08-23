// multiline.tsx - Render multi-line text with <br /> inside a single <text>.

export function renderMultiline(text: string) {
  const lines = text.split('\n');
  if (lines.length === 1) return lines[0];
  return lines.map((line, idx) => (
    <span key={idx}>
      {line}
      {idx < lines.length - 1 ? <br /> : null}
    </span>
  ));
}
