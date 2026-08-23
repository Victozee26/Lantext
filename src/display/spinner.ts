// spinner.ts - Minimal plain spinner for client discovery.

export interface Spinner {
  start(): void;
  succeed(text?: string): void;
}

export function createSpinner(text: string): Spinner {
  const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  const animated = Boolean(process.stderr.isTTY);
  let timer: NodeJS.Timeout | null = null;
  let index = 0;
  let started = false;

  const clear = (): void => {
    if (timer !== null) {
      clearInterval(timer);
      timer = null;
    }
    started = false;
  };

  return {
    start(): void {
      if (started) return;
      started = true;
      if (!animated) {
        process.stderr.write(`  ${text}\n`);
        return;
      }
      process.stderr.write(`  ${frames[0]} ${text}`);
      timer = setInterval(() => {
        index = (index + 1) % frames.length;
        process.stderr.write(`\r  ${frames[index]} ${text}\x1b[K`);
      }, 80);
    },
    succeed(text?: string): void {
      clear();
      if (animated) process.stderr.write('\r\x1b[K');
      if (text !== undefined) process.stderr.write(`  ✔ ${text}\n`);
    },
  };
}
