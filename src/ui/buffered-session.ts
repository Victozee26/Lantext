// buffered-session.ts - Transport-agnostic ChatSession event surface with
// early-event buffering.
//
// Why buffering exists (Phase 4 contract): events emitted before the first
// subscriber attaches are otherwise LOST. The chat orchestrators start the
// transport only after the runtime/UI is up, but the React mount effect
// (useChatSession) subscribes AFTER the render commit — a tiny window where
// transport events (e.g. LanClient's SYNCHRONOUS 'status' from discover())
// can fire with zero listeners. BufferedSession queues events PER EVENT
// until the first subscriber attaches, then flushes queued payloads in
// order and forwards live from then on. The latch is per event: events that
// never get a subscriber are never buffered, and once latched, unlistened
// events drop like a plain EventEmitter (standard semantics).
//
// Deliberately NOT Node's EventEmitter and free of transport imports: the
// UI layer stays decoupled and this class is trivially testable in
// isolation. Adapters (built by the mode orchestrators) forward transport
// events into it via emit(); the UI subscribes via on()/off().

import type { ChatSession, ChatSessionEventMap, ChatSessionEventName } from './session-adapter.js';

/** Safety cap per event: buffering exists only for the mount-commit window,
 *  so a pathological never-subscribed adapter cannot grow unboundedly.
 *  Oldest payloads drop first. */
const MAX_BUFFERED_EVENTS = 100;

type Listener = (...args: unknown[]) => void;

export class BufferedSession implements Pick<ChatSession, 'on' | 'off'> {
  private readonly listeners = new Map<ChatSessionEventName, Set<Listener>>();
  private readonly pending = new Map<ChatSessionEventName, unknown[][]>();
  private readonly subscribed = new Set<ChatSessionEventName>();

  /** Attach a listener. On the FIRST attach per event, queued payloads are
   *  flushed to the new listener in emission order. */
  on<K extends ChatSessionEventName>(event: K, listener: ChatSessionEventMap[K]): void {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set<Listener>();
      this.listeners.set(event, set);
    }
    set.add(listener as Listener);

    if (!this.subscribed.has(event)) {
      this.subscribed.add(event);
      const queued = this.pending.get(event);
      if (queued) {
        this.pending.delete(event);
        for (const args of queued) {
          (listener as Listener)(...args);
        }
      }
    }
  }

  off<K extends ChatSessionEventName>(event: K, listener: ChatSessionEventMap[K]): void {
    this.listeners.get(event)?.delete(listener as Listener);
  }

  /** Forward a transport event into the session. Buffered per event until
   *  the first subscriber attaches, live afterwards. Adapter wiring calls
   *  this; UI consumers only call on()/off(). */
  emit<K extends ChatSessionEventName>(event: K, ...args: Parameters<ChatSessionEventMap[K]>): void {
    const set = this.listeners.get(event);
    if (set && set.size > 0) {
      for (const listener of set) {
        (listener as (...args: Parameters<ChatSessionEventMap[K]>) => void)(...args);
      }
      return;
    }
    if (!this.subscribed.has(event)) {
      const queued = this.pending.get(event) ?? [];
      queued.push(args as unknown[]);
      if (queued.length > MAX_BUFFERED_EVENTS) queued.shift();
      this.pending.set(event, queued);
    }
  }
}