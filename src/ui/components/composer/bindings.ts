// bindings.ts - Composer key bindings (SRP: isolated constant).

import type { KeyBinding } from '@opentui/core';

export const COMPOSER_KEY_BINDINGS: KeyBinding[] = [
  { name: 'return', action: 'submit' },
  { name: 'kpenter', action: 'submit' },
  { name: 'linefeed', action: 'newline' },
  { name: 'return', shift: true, action: 'newline' },
  { name: 'kpenter', shift: true, action: 'newline' },
  { name: 'linefeed', shift: true, action: 'newline' },
  { name: 'return', meta: true, action: 'newline' },
  { name: 'kpenter', meta: true, action: 'newline' },
  { name: 'linefeed', meta: true, action: 'newline' },
  { name: 'j', ctrl: true, action: 'newline' },
  { name: 'linefeed', ctrl: true, action: 'newline' },
];
