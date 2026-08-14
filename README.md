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

- **Beautiful Terminal UI**: Claude Code-inspired interface with rich colors, animated spinners, and an interactive select menu.
- **Auto-discovery**: Automatically finds the chat server on the network
- **Multiple clients**: Support for multiple simultaneous connections
- **Hotspot mode**: WiFi hotspot devices can both host and participate in chat
- **Real-time messaging**: Instant message delivery across the network
- **Global CLI**: Install once, run anywhere with `lantext` command

## Installation

### Install from npm

```bash
npm install -g lantext
lantext
```

For a local installation, install the package without the global flag and run
it with `npx`:

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

The CLI will ask you whether you want to be a **WiFi client** (connect to existing network) or **hotspot** (create server).

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

When running from a source checkout, use `npm start -- <mode>` after building:

```bash
npm start -- client
npm start -- hotspot
```

### Multi-line Messages

LanText supports sending multiple lines of text as a single message. To send a multi-line message:

1. Type your first line and press Enter
2. Continue typing additional lines, pressing Enter after each line
3. When done, press Enter again on an empty line to send the entire message

**Example:**
```text
❯ Line 1 of my message
❯ Line 2 of my message
❯ Line 3 of my message
  ✓ Sent  12:34:56
  │ Line 1 of my message
  │ Line 2 of my message
  │ Line 3 of my message
❯
```

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

- **Main** (`src/main.ts`): CLI entry point, argument parsing, and interactive mode selection.
- **Client mode** (`src/client-mode.ts`): Coordinates client networking, input, and terminal updates.
- **Server mode** (`src/server-mode.ts`): Coordinates hotspot networking, input, and terminal updates.
- **Client transport** (`src/client.ts`): Discovers servers, manages TCP connections, parses incoming messages, and reconnects.
- **Hotspot transport** (`src/hotspot.ts`): Runs the TCP server, answers UDP discovery, and broadcasts messages.
- **Input** (`src/input.ts`): Handles terminal, pasted, multi-line, and piped input.
- **UI** (`src/ui.ts`): Provides terminal styling, banners, status lines, and message formatting.
- **Utilities** (`src/utils.ts`): Defines ports, discovery messages, network helpers, and message envelopes.

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

