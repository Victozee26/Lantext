// protocol barrel — stable import surface for wire concerns.
export { PORTS, DISCOVERY_MSG, FOUND_MSG } from './constants.js';
export type { MessageEnvelope } from './envelope.js';
export { createEnvelope } from './envelope.js';
export { encodePayload, decodePayload, normalizeForHotspot, encodeEnvelope, decodeEnvelope, splitBuffer } from './codec.js';
export { getVersion } from './version.js';
export { getLocalIP, getSubnet } from './network.js';
export type { NetworkInterfacesProvider } from './network.js';
