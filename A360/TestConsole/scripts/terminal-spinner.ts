/**
 * Renders a dependency-free, single-line terminal spinner without affecting redirected output.
 */

import process from 'node:process';

interface SpinnerOutput {
  isTTY?: boolean;
  write(text: string): boolean;
}

export type TerminalSpinnerStyle = 'braille' | 'classic';

const frameSets: Record<TerminalSpinnerStyle, string[]> = {
  braille: ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'],
  classic: ['|', '/', '-', '\\'],
};
const clearLine = '\r\u001b[2K';
const previousLine = '\u001b[1A';

export function terminalSpinnerStyle(value: string | undefined): TerminalSpinnerStyle {
  if (!value || value === 'classic') return 'classic';
  if (value === 'braille') return value;
  throw new Error(`Unknown terminal spinner style "${value}"; use braille or classic.`);
}

export class TerminalSpinner {
  private active = false;
  private frameIndex = 0;
  private interval: NodeJS.Timeout | undefined;
  private label = '';
  private paused = false;
  private rendered = false;

  constructor(
    private readonly output: SpinnerOutput = process.stdout,
    private readonly style: TerminalSpinnerStyle = 'classic',
  ) {}

  start(label: string): void {
    this.stop();
    if (!this.output.isTTY) return;
    this.active = true;
    this.label = label;
    this.render();
    this.interval = setInterval(() => this.render(), 80);
    this.interval.unref();
  }

  pause(): void {
    if (!this.active || this.paused) return;
    this.paused = true;
    this.clear();
  }

  resume(): void {
    if (!this.active || !this.paused) return;
    this.paused = false;
    this.render();
  }

  stop(): void {
    if (this.interval) clearInterval(this.interval);
    this.interval = undefined;
    this.clear();
    this.active = false;
    this.frameIndex = 0;
    this.label = '';
    this.paused = false;
  }

  private clear(): void {
    if (!this.rendered) return;
    this.output.write(`${previousLine}${clearLine}`);
    this.rendered = false;
  }

  private render(): void {
    if (!this.active || this.paused) return;
    const frames = frameSets[this.style];
    const frame = frames[this.frameIndex % frames.length];
    this.frameIndex += 1;
    const position = this.rendered ? previousLine : '';
    this.output.write(`${position}${clearLine}${this.label} ${frame}\n`);
    this.rendered = true;
  }
}