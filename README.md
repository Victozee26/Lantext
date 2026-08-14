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

### Global Installation (Recommended)

```bash
npm install -g lantext
```

### Local Installation

```bash
npm install lantext
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

LanText is built on a peer-to-peer discovery model using UDP for finding servers and TCP for reliable messaging.

- **Client** (`src/client.ts`): Discovers and connects to a server on the network. Implements a multi-line input buffer for seamless typing.
- **Hotspot** (`src/hotspot.ts`): Runs both a TCP server and a discovery responder. It broadcasts messages to all connected clients.
- **Main** (`src/main.ts`): CLI entry point that handles interactive mode and argument parsing.
- **UI** (`src/ui.ts`): Shared module for consistent terminal styling, banners, and message formatting.

For a deep dive into the technical implementation, see [ARCHITECTURE.md](./ARCHITECTURE.md).

## Configuration

Environment variables:

- `DEBUG=true` - Enable debug logging
- `SERVER=<ip>` - Specify server IP address (skips discovery)

## License

MIT


