# Plan: Rooms (host identity + selection)

Status: implemented — v3.1.0
Owner: root `AGENTS.md`
Target: v3.1.0

## Problem

LanText treats "host" as a singleton resource with no lock. `startDiscovery`
accepts the **first** `SERVER_FOUND` reply and closes the socket, so when two
devices host on the same LAN:

- clients connect to whichever host replied first (loosely: the lowest IP),
- reconnects re-run discovery and may silently attach to a **different** host,
- every host labels its messages `sender: "HOST"`, so two conversations merge
  with no marker.

There is no host identity anywhere on the wire. The client cannot choose
correctly even if it wanted to.

## Locked decisions

- **A host is a room.** One host process = one room. No host migration, no
  handoff, no federation.
- **`hostId` is persisted per install**, not per process. A restart must be
  the same room.
- **Backwards compatible wire change.** Add JSON fields; do not change
  `DISCOVERY_MSG`, the ports, or the envelope framing.
- **Sticky reconnect.** Never auto-connect to a different `hostId`.
- **Auto-connect only when exactly one room answers**, or when `SERVER=` is
  set. Two or more rooms always means a human choice in a TTY.
- **Out of scope:** passwords, encryption, history sync, room capacity limits,
  host election.

## Wire contract

Discovery request is unchanged: the exact string `LAN_CHAT_DISCOVERY` sent to
UDP `41237`.

Reply (one JSON datagram, unicast back to the sender):

```json
{
  "type": "SERVER_FOUND",
  "hostId": "6f1c2a9e-6b1f-4c1e-9a4e-2f7c1b0d8e33",
  "name": "Victor's room",
  "clients": 3,
  "version": "3.0.0",
  "port": 41236
}
```

Compatibility matrix:

| Peer | Behavior |
|---|---|
| old client + new host | Ignores unknown fields. Works. |
| new client + old host | Missing `hostId` → anonymous room, legacy first-reply behavior. |
| new client + new host | Full identity, selection, sticky reconnect. |

`address` is removed from the reply in 3.1. It was always `"0.0.0.0"` and
every client ignored it (the client uses `rinfo.address`). `port` becomes
meaningful: new clients connect to the advertised port instead of hardcoding
`PORTS.TCP`.

## Host identity

- Persist `{ hostId, name }` to `$XDG_CONFIG_HOME/lantext/host.json`
  (fallback `~/.config/lantext/host.json`; `%APPDATA%\lantext\host.json` on
  Windows).
- `hostId`: `crypto.randomUUID()` on first host start. Never derive it from
  IP, MAC, or hostname — all three change.
- `name`: defaults to `os.hostname()`. Editable with `--name "<room>"` and in
  the host TUI.
- Config unreadable/corrupt → regenerate and overwrite. Config unwritable →
  use an in-memory id for this session and emit a debug line; never block
  hosting.
- Two hosts may share a name. The picker must always show IP + a short
  `hostId` prefix, and must never auto-pick when more than one room exists.

## Client discovery state machine

```
IDLE
 └─ start() ─────────────────────────────► SCANNING
                                             │ send probes, collect replies
                                             │ for COLLECT_WINDOW_MS (700 ms)
                                             ▼
                          ┌──────────── 0 rooms ──► RETRY (1 s, existing loop)
                          ├──────────── 1 room  ──► CONNECT
                          └──────────── N rooms ──► PICK (TTY) / deterministic auto-pick (non-TTY)
CONNECT ──► CONNECTED
CONNECTED ──► disconnect:
                fixedAddress (SERVER=) ──► retry same address
                known hostId ────────────► REDISCOVER, filter by hostId
                hostId gone (3 scans) ───► ROOM_LOST (stop retrying, surface UI)
```

Rules:

- Dedupe by `hostId`; if absent, dedupe by source IP.
- Collect window starts at the **first** valid reply and hard-caps at
  `1.5 s` so a slow host cannot stall the picker.
- Non-TTY deterministic auto-pick: most `clients`, then lexicographic
  `hostId`. Never "first packet wins".
- `SERVER=<ip>` still bypasses discovery entirely and is never sticky-checked
  (it is an explicit address, not a room).
- The existing loopback probe stays, but it is sent last and races the LAN
  sweep; with a collect window the race no longer decides the outcome.

## Reconnect rules

- Remember `{ hostId, name, address }` for the chosen room.
- On disconnect: re-scan, then connect **only** to the same `hostId`.
- Host moved to a new IP (DHCP): same `hostId`, new address → reconnect.
- Host not found after 3 scans: emit `roomLost`, disable the composer, show
  `Room "<name>" is gone. [r]etry  [c]hoose another`.
- A different host answering is never an automatic substitute.

## UI

- Mode select stays `Client` / `Host`.
- Host: prompt for room name (default `os.hostname()`), then start.
- Client, 1 room: connect immediately; status line `Joining <name>`.
- Client, N rooms: `<select>` (same component pattern as
  `src/ui/components/mode-select.tsx`). Each row: `name`, `ip:port`,
  `N online`, and a warning when the host's major version differs.
- Status bar: `connected to <name> (<ip>)`; fall back to the bare IP for
  anonymous/legacy hosts.
- `roomLost` state: status line + disabled composer + retry/choose keys.

## Version negotiation

`version` in the reply is advisory. A major-version mismatch shows a warning
in the picker and status bar but does not block. The envelope stays unchanged;
host messages keep `sender: "HOST"` in 3.1 so mixed-version peers do not
suddenly render a different sender label.

## File map

| File | Change |
|---|---|
| `src/protocol/discovery.ts` | New: `DiscoveryReply` type, parse + validate (legacy tolerant). |
| `src/server/identity.ts` | New: load/save `hostId` + `name`, corrupt-file recovery. |
| `src/server/discovery.ts` | Include `hostId`, `name`, `clients`, `version`, `port`. |
| `src/client/discovery.ts` | Collect window, dedupe, return `DiscoveryResult[]`. |
| `src/client.ts` | Selection policy, sticky reconnect, `roomLost`. |
| `src/ui/components/room-picker.tsx` | New: select list with room metadata. |
| `src/ui/hooks/use-connection.ts` | Reintroduce `rooms` state + `roomLost`. |
| `src/modes/client-tui.ts` / `client-plain.ts` | Picker vs deterministic auto-pick. |
| `src/ui/session-adapter.ts` | Add `rooms` / `roomLost` events. |

## Tests

- identity: persists across loads; corrupt JSON regenerates; unwritable path
  falls back without throwing.
- reply parser: full reply, legacy reply without `hostId`, malformed JSON,
  wrong `type`.
- client discovery: collects multiple replies, dedupes by `hostId`, closes on
  the window, returns all rooms, ignores replies after close.
- selection: 0 → retry, 1 → connect, N → picker (TTY) / deterministic pick
  (non-TTY), `SERVER=` bypass.
- reconnect: same `hostId` reconnects; different `hostId` ignored; 3 misses
  emit `roomLost`.
- architecture guard: no `src/ui/**` → transport imports.

## Phases

1. **Wire identity (host side).** `hostId`/`name` persistence, reply fields,
   parser tests. Old clients unaffected. Ship behind no flag — additive only.
2. **Client collection.** Collect window + dedupe; still auto-connect to the
   deterministic pick. No UI change.
3. **Sticky reconnect.** Remember the room; `roomLost`; no silent migration.
4. **Picker UI.** TUI list + plain-mode warning when N > 1.
5. **Docs + release.** README, `AGENTS.md`, version bump to 3.1.0.

Each phase must keep `npm test`, `npm run lint`, `npm run knip`, and
`npm run typecheck` green.

## Risks

- **Office/guest WiFi** blocks device-to-device traffic (client isolation,
  VLANs). Rooms do not fix that; the README already says so.
- **Config path on Termux/Android** — XDG is usually set, but fall back to
  `$HOME/.config` and then an in-memory id.
- **Clock skew** — `timestamp` is host-local; irrelevant to selection.
- **Duplicate room names** — picker always shows IP + `hostId` prefix.
- **Non-TTY auto-pick** — deterministic, but still a guess; print the chosen
  room and the alternatives so the user can switch with `SERVER=`.

## Out of scope (deliberately)

Passwords, encryption, message history sync for late joiners, host migration,
room discovery across subnets, federation, "busiest room" heuristics.
