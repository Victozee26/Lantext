// ui.ts - Backward-compat barrel for plain-text non-TTY helpers.
// New code should import from `src/display/*` directly.

export { theme } from './display/theme.js';
export { showBanner } from './display/banner.js';
export { status, statusSuccess, statusError } from './display/status.js';
export { formatIncoming, formatSent } from './display/format.js';
export { formatHelp } from './display/help.js';
export { createSpinner } from './display/spinner.js';
export type { Spinner } from './display/spinner.js';
export { clientConnected, clientDisconnected } from './display/clients.js';
export { debug } from './display/debug.js';
