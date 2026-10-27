# LanText

<p align="center">
  <img
    style="
      border-radius: 16px;
    "
    src='asset/logo-1.jpeg' width='100%'>
</p>

A lightweight local area network chat application that enables real-time communication between WiFi-connected devices.

## Why LanText Exists
Sending a quick message from your phone to your laptop or to a colleague’s device is surprisingly frustrating. Most solutions require WhatsApp, Telegram, or cloud apps, which is overkill for a single text. LanText solves this by providing direct, local, real-time messaging with minimal setup.

## Features

- **OpenTUI terminal UI**: interactive mode-select screen, host room-name
  prompt, and chat screen with a header (brand, IP, mode, version), scrollable
  message feed, status bar, and multi-line composer. Piped/non-TTY use gets
  plain-text output with no ANSI color codes.
- **Rooms with stable identity**: each host is a room with a persisted
  `hostId` and an editable name. Clients see every room, choose one when
  several answer, and reconnect only to the same room.
- **Auto-discovery**: Finds every room on the network, not just the first one
  to reply.
- **Multiple clients**: Support for multiple simultaneous connections
- **Host mode**: One device acts as host and other devices connect as clients
- **Real-time messaging**: Instant message delivery across the network
- **Global CLI**: Install once, run anywhere with `lantext` command

## Requirements

- **Node.js >= 26.4.0**: OpenTUI acceptance pins 26.4.0; LanText is tested on
  26.5.0.
- The OpenTUI renderer needs the `--experimental-ffi` flag. All npm scripts
  embed it automatically, and the global/npx `lantext` binary re-launches
  itself with the flag via a small bin shim (`dist/bin.js`). For exotic
  setups, `NODE_OPTIONS=--experimental-ffi lantext` works as a fallback.
- Verified on Linux glibc arm64 under proot (Termux). Upstream Node.js
  acceptance covers Linux x64; darwin and win32 artifacts exist but are not
  tested by this project.

## Installation

### Install from npm

```bash
npm install -g lantext
lantext
```

The installed `lantext` command is a self-relaunching bin shim: it starts
Node with `--experimental-ffi` automatically (arguments, signals, and exit
codes are forwarded), so no extra flags are needed.

For a local installation, install the package without the global flag and run
it with `npx` (same shim behavior):

```bash
npm install lantext
npx lantext
```

### Run from source

```bash
git clone https://github.com/Victozee26/LanText.git
cd LanText
npm install
npm run build
npm start
```

## Usage

### Interactive Mode (Recommended)

Simply run `lantext` and choose your mode:

```bash
lantext
```

An OpenTUI select screen offers **Client** (connect to an existing
host) and **Host** (create a host). Arrow keys move, Enter
selects, `q`/ESC quits cleanly. With non-interactive (piped) stdin the help
text is printed instead.

### Direct Mode

You can also specify the mode directly:

```bash
# Connect as client
lantext client    # or lantext -c / lantext --client

# Start as host
lantext host      # or lantext -h / lantext --host
```

When running from a source checkout, use `npm start -- <mode>` after building
(the npm scripts embed `--experimental-ffi`; the global `lantext` shim adds
it automatically):

```bash
npm start -- client
npm start -- host
npm start -- -c
npm start -- -h
```

### Rooms and Room Names

A host process is one room. Its identity (`hostId` + name) is persisted at
`$XDG_CONFIG_HOME/lantext/host.json` (fallback
`~/.config/lantext/host.json`; `%APPDATA%\lantext\host.json` on Windows), so
restarting the host keeps the same room.

Set the name from the CLI:

```bash
lantext host --name "Living Room"
```

Without `--name`, a TTY host prompts for the room name before opening any
socket. The persisted name is pre-filled, Enter keeps it, and Escape cancels
without starting a server. The chosen name appears in the host status bar.

When exactly one room answers discovery, the client joins it. When several
rooms answer, a TTY client shows a picker with the room name, `ip:port`,
online count, and a short `hostId` prefix (duplicate names are legal; the id
disambiguates). Enter joins the selected room; `q`/Escape quits. A host from a
different major version is marked with a warning, never blocked. Non-TTY
clients print every alternative and use a deterministic pick (most online
clients, then lexicographic `hostId`) instead of "first reply wins".

Reconnect is sticky for rooms with an identity: the client rediscovers and
joins only the remembered `hostId`, even if the host moved to a new DHCP
address, and never silently switches rooms. After three scans without that
room, the status line shows `Room "<name>" is gone`; the composer is disabled
and `r` retries / `c` opens discovery again. Legacy 3.0 rooms have no
`hostId`, so they are not sticky: reconnect falls back to normal discovery,
which opens the picker on a TTY when several rooms answer (or auto-connects
when exactly one does). `SERVER=<ip>` is an explicit address, so it bypasses
discovery and room stickiness.

### Multi-line Messages

In the chat screen, **Enter** sends the message and **Shift+Enter** (or
Meta+Enter) inserts a newline. The composer grows up to three lines and
scrolls internally beyond that; bracketed paste is inserted as-is.

Piped (non-TTY) input sends one line per newline-delimited line of stdin.

### Debug Mode

```bash
DEBUG=true lantext client
```

### Connect to Specific Host

```bash
SERVER=192.168.1.5 lantext client
```

`localhost` / `127.0.0.1` also work as the `SERVER` value.

### Local Two-Terminal Test

Both roles can run on one machine over the loopback interface:

```bash
# Terminal 1 - host (Enter accepts the persisted/default room name)
npm run host

# Terminal 2 - client
npm run client
```

Discovery probes `127.0.0.1`, so the client in terminal 2 finds the local
host automatically; set `SERVER=127.0.0.1` to skip discovery. Run host
mode in only one session: a second host fails with `EADDRINUSE` while the
ports are held.

## Architecture

LanText uses UDP discovery to find hosts on the local network and TCP for
reliable messaging. The default ports are UDP `41237` for discovery and TCP
`41236` for chat connections.

The TypeScript source is compiled from `src/` to `dist/` before the CLI runs.

- **Main** (`src/main.ts`): CLI entry point, argument parsing, and interactive mode selection (OpenTUI mode-select screen on a TTY; plain help fallback otherwise).
- **Bin shim** (`src/bin.ts`): self-relaunching shim behind the global `lantext` command; re-execs Node with `--experimental-ffi`, forwarding args, signals, and exit codes.
- **Client mode** (`src/client-mode.ts`): Coordinates client networking, input, and terminal updates.
- **Host mode** (`src/server-mode.ts`): Coordinates host networking, input, and terminal updates.
- **Client transport** (`src/client.ts`): Collects every room in a discovery window, selects one, manages TCP connections, parses incoming messages, and reconnects stickily to the remembered `hostId`.
- **Client discovery/selection** (`src/client/discovery.ts`, `src/client/selection.ts`): Dedupes replies by `hostId`, enforces the 700 ms collection window / 1.5 s hard cap, and applies the deterministic ranking.
- **Host transport** (`src/hotspot.ts`): Runs the TCP host, advertises the persisted room identity in every UDP reply, and broadcasts messages.
- **Host identity** (`src/server/identity.ts`): Persists `hostId` and room name, recovers from corrupt files, and falls back to an in-memory identity when the config path is unwritable.
- **Input** (`src/input.ts`): Handles piped (non-TTY) input. TTY input is owned by the OpenTUI composer.
- **UI** (`src/ui/`): OpenTUI application (mode-select screen, host room-name prompt, room picker, chat screen, components, runtime, session adapter).
- **Display** (`src/display/`): Plain-text, ANSI-free non-TTY helpers (banner, help text, room list, piped output lines, status lines, spinner, debug logging).
- **Protocol** (`src/protocol/`): Ports, discovery request/reply encoding, envelopes, wire codec, network helpers, and the shared runtime version helper.

Discovery replies carry `hostId`, `name`, `clients`, `version`, and `port`;
the request string and ports are unchanged from 3.0. A missing `hostId` means
a legacy anonymous room. Messages use newline-delimited JSON envelopes with
`sender`, `timestamp`, and `text` fields.

## Development

```bash
# Compile TypeScript to dist/
npm run build

# Type-check without emitting files
npm run typecheck

# Build and start with debug logging enabled
npm run dev

# Unit tests (node:test, no extra runner)
npm test

# Lint + architecture boundary check
npm run lint

# Dead-code report
npm run knip
```

Linting note: TypeScript 7's compiler API is not published yet, so
`typescript-eslint` and `dependency-cruiser` cannot parse this project (both
fail or silently scan zero files). Linting uses `oxlint`, and the import
boundaries in `src/AGENTS.md` are enforced by `scripts/check-boundaries.mjs`,
which fails if it scans zero files.

Network changes should still be verified with a client and host on real
devices — the unit suite covers codecs, discovery framing, room selection,
identity persistence, broadcast, network interface selection, buffering, and
reconnect policy, not real radios.

## Configuration

Environment variables:

- `DEBUG=true` - Enable debug logging
- `SERVER=<ip>` - Specify host IP address (skips discovery); `localhost`
  and `127.0.0.1` work for same-machine testing
- `LAN_TEXT_IFACE=<name>` - Pin the network interface used for discovery and
  the advertised address (e.g. `wlan0`). Useful on multi-homed machines
  (VPN, docker, ethernet + WiFi) where the default heuristic picks the wrong
  subnet.

Room configuration:

- `--name "<room>"` - Set and persist the host's room name. Without it, a TTY
  host prompts; the persisted name is the default.
- Host identity file - `$XDG_CONFIG_HOME/lantext/host.json` (fallback
  `~/.config/lantext/host.json`; `%APPDATA%\lantext\host.json` on Windows).
  Deleting it creates a new room identity, so clients that remembered the old
  `hostId` treat it as a different room.

## Security

LanText is **unencrypted and unauthenticated**. Messages travel as plaintext
newline-delimited JSON over TCP, and any device on the same network can
discover, host, or sniff a session. Use it on networks you trust.

Client isolation, VLAN segmentation, and most corporate/guest WiFi setups
block device-to-device traffic entirely — LanText will not discover anything
there. It is designed for home routers, hotspots, and small shared spaces.

## License

MIT

