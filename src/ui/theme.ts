// theme.ts - LanText color palette for OpenTUI (plain hex values, no color
// library). OpenTUI style props accept these as `ColorInput` (string | RGBA)
// on `<text style={{ fg }}>`, `<box borderColor>`, `backgroundColor`, etc.
// Source: the palette previously defined in src/ui.ts as hex tokens.

export interface LanTextTheme {
  brand: string; // LAN blue
  prompt: string; // input prompt
  accent: string; // teal green
  success: string; // teal green
  error: string;
  warning: string;
  info: string; // still used by surviving non-TTY helpers
  muted: string; // still used by surviving non-TTY helpers
  sender: string; // purple for senders
  sent: string;
}

export const THEME: LanTextTheme = {
  brand: '#4A9EFF',
  prompt: '#4A9EFF',
  accent: '#36D399',
  success: '#36D399',
  error: '#F87171',
  warning: '#FBBF24',
  info: '#60A5FA',
  muted: '#6B7280',
  sender: '#C084FC',
  sent: '#34D399',
};