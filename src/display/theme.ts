// theme.ts - Plain-text theme for non-TTY display.
// Identity functions keep call sites unchanged; output has no ANSI.

type PlainStyle = {
  (text: string): string;
  bold: (text: string) => string;
};

const plain: PlainStyle = Object.assign(
  (text: string) => text,
  { bold: (text: string) => text },
);

export const theme = {
  brand: plain,
  accent: plain,
  dim: plain,
  bold: plain,
  success: plain,
  error: plain,
  warning: plain,
  info: plain,
  muted: plain,
  sender: plain,
  sent: plain,
  prompt: plain,
};
