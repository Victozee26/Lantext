// divider.tsx - Full-width thin rule separating messages.

import { THEME } from '../../theme.js';

export function Divider() {
  return (
    <box height={1} width="100%" overflow="hidden" paddingTop={0} paddingBottom={0}>
      <text selectable={false} style={{ fg: THEME.border }}>
        {"─".repeat(300)}
      </text>
    </box>
  );
}
