// debug.ts - Debug logging helper.

export function debug(label: string, msg: string): void {
  if (process.env.DEBUG === 'true') {
    console.log(`  [${label}] ${msg}`);
  }
}
