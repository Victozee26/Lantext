// room-picker.tsx - Interactive room chooser for client mode.
//
// Shown when more than one room answers discovery. Each row carries the
// metadata needed to disambiguate duplicate names: IP:port, online count, a
// short hostId prefix, and a major-version warning. Legacy hosts have no
// hostId/name and are marked as such.
//
// Uses the same <select> pattern as mode-select.tsx; SelectRenderable has no
// intrinsic measure, so width/height are explicit. q / ESC quit the picker.

import { useKeyboard, useTerminalDimensions } from '@opentui/react';
import type { KeyEvent, SelectOption } from '@opentui/core';
import { THEME } from '../theme.js';
import type { RoomInfo } from '../session-adapter.js';

export interface RoomPickerProps {
  rooms: RoomInfo[];
  /** Local app version, used for the advisory major-version warning. */
  localVersion: string;
  onSelect: (key: string) => void;
  onQuit: () => void;
}

function major(version: string | null): string | null {
  if (!version) return null;
  const [first] = version.split('.');
  return first || null;
}

function label(room: RoomInfo): string {
  return room.name ?? room.address;
}

function description(room: RoomInfo, localVersion: string): string {
  const parts = [
    `${room.address}:${room.port}`,
    `${room.clients} online`,
    room.hostId ? `id ${room.hostId.slice(0, 8)}` : 'legacy',
  ];
  const remoteMajor = major(room.version);
  const localMajor = major(localVersion);
  if (remoteMajor !== null && localMajor !== null && remoteMajor !== localMajor) {
    parts.push(`⚠ v${room.version}`);
  }
  return parts.join(' · ');
}

export function RoomPicker({ rooms, localVersion, onSelect, onQuit }: RoomPickerProps) {
  const { width: termWidth, height: termHeight } = useTerminalDimensions();
  useKeyboard((key: KeyEvent) => {
    if (key.name === 'escape') onQuit();
    if (key.name === 'q' && !key.ctrl && !key.meta && !key.shift) onQuit();
  });

  const options: SelectOption[] = rooms.map((room) => ({
    name: label(room),
    description: description(room, localVersion),
    value: room.hostId ?? room.address,
  }));
  const width = Math.max(30, Math.min(64, (termWidth || 80) - 8));
  const maxVisible = Math.max(2, Math.min(12, (termHeight || 24) - 10));
  const height = Math.min(Math.max(rooms.length * 2, 2), maxVisible);

  return (
    <box flexDirection="column" alignItems="center" justifyContent="center" flexGrow={1}>
      <text style={{ fg: THEME.accent }}>choose a room</text>
      <text style={{ fg: THEME.muted }}>{rooms.length} hosts answered discovery</text>
      <box paddingTop={1} />
      <box
        borderStyle="rounded"
        border
        borderColor={THEME.border}
        title=" rooms "
        titleColor={THEME.brand}
        paddingLeft={2}
        paddingRight={4}
        paddingTop={0}
        paddingBottom={0}
      >
        <select
          options={options}
          onSelect={(_index, option) => {
            if (option && typeof option.value === 'string') onSelect(option.value);
          }}
          focused
          width={width}
          height={height}
          wrapSelection
          showDescription
          showScrollIndicator
          selectedIndex={0}
          textColor={THEME.muted}
          focusedTextColor={THEME.info}
          selectedTextColor={THEME.info}
          descriptionColor={THEME.muted}
          selectedDescriptionColor={THEME.accent}
          selectedBackgroundColor="transparent"
          backgroundColor="transparent"
        />
      </box>
      <box paddingTop={1} />
      <box flexDirection="row" height={1}>
        <text style={{ fg: THEME.muted }}>↑↓ navigate · enter join · </text>
        <text style={{ fg: THEME.brand }}>q</text>
        <text style={{ fg: THEME.muted }}> quit</text>
      </box>
    </box>
  );
}
