// reconnect.ts - Reconnection policy for LanClient.
// Pure timer scheduling, no socket knowledge.

export interface ReconnectPolicy {
  schedule: (fn: () => void) => void;
  cancel: () => void;
}

export function createReconnectPolicy(delayMs: number): ReconnectPolicy {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return {
    schedule(fn) {
      if (timer) clearTimeout(timer);
      timer = setTimeout(fn, delayMs);
    },
    cancel() {
      if (timer) { clearTimeout(timer); timer = null; }
    },
  };
}
