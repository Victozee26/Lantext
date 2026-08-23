// theme.ts - LanText color palette for OpenTUI (plain hex values, no color
// library). OpenTUI style props accept these as `ColorInput` (string | RGBA)
// on `<text style={{ fg }}>`, `<box borderColor>`, `backgroundColor`, etc.
// Source: the palette previously defined in src/ui.ts as hex tokens.
//
// Surface tokens tint the structural chrome (borders, bubbles) against a
// near-black terminal background; they are intentionally dim so message
// content carries the color. mixHex() is presentation-only interpolation
// used for gradient text (mode-select wordmark).

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
  /** Structural border slate (header banner, incoming bubbles, composer). */
  border: string;
  /** Fill for own-sent bubbles (dark green tint). */
  selfBg: string;
  /** Fill for incoming bubbles (dark blue-gray tint). */
  otherBg: string;
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
  border: '#2E3A4E',
  selfBg: '#12241D',
  otherBg: '#1A2230',
};

/** Parse `#RRGGBB` into [r, g, b]. Throws on malformed input: callers pass
 *  THEME tokens, never user data. */
function hexToRgb(hex: string): [number, number, number] {
  const value = hex.replace('#', '');
  return [
    parseInt(value.slice(0, 2), 16),
    parseInt(value.slice(2, 4), 16),
    parseInt(value.slice(4, 6), 16),
  ];
}

/** Linear interpolation between two `#RRGGBB` colors. t=0 -> a, t=1 -> b. */
export function mixHex(a: string, b: string, t: number): string {
  const clamped = Math.min(1, Math.max(0, t));
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  const channel = (i: number): string =>
    Math.round(ca[i] + (cb[i] - ca[i]) * clamped)
      .toString(16)
      .padStart(2, '0');
  return `#${channel(0)}${channel(1)}${channel(2)}`;
}
