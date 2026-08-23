# LanText

<p align="center">
  <img
    style="
      border-radius: 16px;
    "
    src='asset/logo-1.jpeg' width='160'>
</p>

A lightweight local area network chat application that enables real-time communication between WiFi-connected devices.

## Why LanText Exists
Sending a quick message from your phone to your laptop or to a colleague’s device is surprisingly frustrating. Most solutions require WhatsApp, Telegram, or cloud apps, which is overkill for a single text. LanText solves this by providing direct, local, real-time messaging with minimal setup.

## Features

- **OpenTUI terminal UI**: interactive mode-select screen and chat screen with
  a header (brand, IP, mode, version), scrollable message feed, status bar,
  and multi-line composer. Piped/non-TTY use gets plain-text output with no
  ANSI color codes.
- **Auto-discovery**: Automatically finds the chat server on the network
- **Multiple clients**: Support for multiple simultaneous connections
- **Hotspot mode**: WiFi hotspot devices can both host and participate in chat
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

An OpenTUI select screen offers **WiFi client** (connect to an existing
network) and **Hotspot server** (create a server). Arrow keys move, Enter
selects, `q`/ESC quits cleanly. With non-interactive (piped) stdin the help
text is printed instead.

### Direct Mode

You can also specify the mode directly:

```bash
# Connect as WiFi client
lantext client
# or
lantext wifi

# Start as hotspot server
lantext hotspot
# or
lantext server
```

When running from a source checkout, use `npm start -- <mode>` after building
(the npm scripts embed `--experimental-ffi`; the global `lantext` shim adds
it automatically):

```bash
npm start -- client
npm start -- hotspot
```

### Multi-line Messages

In the chat screen, **Enter** sends the message and **Shift+Enter** (or
Meta+Enter) inserts a newline. The composer grows up to three lines and
scrolls internally beyond that; bracketed paste is inserted as-is.

Piped (non-TTY) input sends one line per newline-delimited line of stdin.

### Debug Mode

```bash
DEBUG=true lantext client
```

### Connect to Specific Server

```bash
SERVER=192.168.1.5 lantext client
```

## Architecture

LanText uses UDP discovery to find servers on the local network and TCP for
reliable messaging. The default ports are UDP `41237` for discovery and TCP
`41236` for chat connections.

The TypeScript source is compiled from `src/` to `dist/` before the CLI runs.

- **Main** (`src/main.ts`): CLI entry point, argument parsing, and interactive mode selection (OpenTUI mode-select screen on a TTY; plain help fallback otherwise).
- **Bin shim** (`src/bin.ts`): self-relaunching shim behind the global `lantext` command; re-execs Node with `--experimental-ffi`, forwarding args, signals, and exit codes.
- **Client mode** (`src/client-mode.ts`): Coordinates client networking, input, and terminal updates.
- **Server mode** (`src/server-mode.ts`): Coordinates hotspot networking, input, and terminal updates.
- **Client transport** (`src/client.ts`): Discovers servers, manages TCP connections, parses incoming messages, and reconnects.
- **Hotspot transport** (`src/hotspot.ts`): Runs the TCP server, answers UDP discovery, and broadcasts messages.
- **Input** (`src/input.ts`): Handles piped (non-TTY) input. TTY input is owned by the OpenTUI composer.
- **UI** (`src/ui/`): OpenTUI application (mode-select screen, chat screen, components, runtime, session adapter).
- **UI helpers** (`src/ui.ts`): Plain-text, ANSI-free non-TTY display helpers (help text, piped output lines, status lines, debug logging).
- **Utilities** (`src/utils.ts`): Defines ports, discovery messages, network helpers, message envelopes, and the shared runtime version helper.

Messages use newline-delimited JSON envelopes with `sender`, `timestamp`, and
`text` fields.

## Development

```bash
# Compile TypeScript to dist/
npm run build

# Type-check without emitting files
npm run typecheck

# Build and start with debug logging enabled
npm run dev
```

There is currently no automated test script in `package.json`. Network changes
should be verified with a client and hotspot on the appropriate local devices.

## Configuration

Environment variables:

- `DEBUG=true` - Enable debug logging
- `SERVER=<ip>` - Specify server IP address (skips discovery)

## License

MIT

