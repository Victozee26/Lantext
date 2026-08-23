// utils.ts - DEPRECATED barrel: re-exports from src/protocol/*.
// New code must import from `src/protocol/*` directly.
// Kept for one minor (2.1.x) for backward-compat; will be removed in 2.2.

/** @deprecated import from `src/protocol/envelope.js` */
export type { MessageEnvelope } from './protocol/envelope.js';
/** @deprecated import from `src/protocol/envelope.js` */
export { createEnvelope } from './protocol/envelope.js';
/** @deprecated import from `src/protocol/constants.js` */
export { PORTS, DISCOVERY_MSG, FOUND_MSG } from './protocol/constants.js';
/** @deprecated import from `src/protocol/network.js` */
export { getLocalIP, getSubnet } from './protocol/network.js';
/** @deprecated import from `src/protocol/version.js` */
export { getVersion } from './protocol/version.js';
