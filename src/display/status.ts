// status.ts - Status line helpers (plain-text).

export function status(label: string, msg: string): void {
  const prefix = label === 'CLIENT' ? `  ● ${label}` : `  ◆ ${label}`;
  console.log(`${prefix} │ ${msg}`);
}

export function statusSuccess(label: string, msg: string): void {
  console.log(`  ✔ ${label} │ ${msg}`);
}

export function statusError(label: string, msg: string): void {
  console.log(`  ✖ ${label} │ ${msg}`);
}
