/**
 * Verifies that the catalog spinner animates only for an interactive terminal and clears cleanly.
 */

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  TerminalSpinner,
  terminalSpinnerStyle,
  type TerminalSpinnerStyle,
} from '../../scripts/terminal-spinner.js';

interface FakeOutput {
  isTTY: boolean;
  writes: string[];
  write: (text: string) => boolean;
}

const output = (isTTY: boolean): FakeOutput => {
  const writes: string[] = [];
  return {
    isTTY,
    writes,
    write(text) {
      writes.push(text);
      return true;
    },
  };
};

const label = '[API] Indexing Test Catalog...';
const clearLine = '\r\u001b[2K';
const previousLine = '\u001b[1A';
interface SpinnerCase {
  style: TerminalSpinnerStyle;
  firstFrames: [string, string];
}

const spinnerCases: Record<TerminalSpinnerStyle, SpinnerCase> = {
  braille: { style: 'braille', firstFrames: ['⠋', '⠙'] },
  classic: { style: 'classic', firstFrames: ['|', '/'] },
};

const assertSpinnerLifecycle = ({ style, firstFrames }: SpinnerCase): void => {
  const terminal = output(true);
  const spinner = new TerminalSpinner(terminal, style);

  spinner.start(label);
  spinner.pause();
  spinner.resume();
  spinner.stop();

  assert.deepEqual(terminal.writes, [
    `${clearLine}${label} ${firstFrames[0]}\n`,
    `${previousLine}${clearLine}`,
    `${clearLine}${label} ${firstFrames[1]}\n`,
    `${previousLine}${clearLine}`,
  ]);
};

test('renders, pauses, resumes, and clears the Braille spinner', () =>
  assertSpinnerLifecycle(spinnerCases.braille),
);

test('renders, pauses, resumes, and clears the Classic spinner', () =>
  assertSpinnerLifecycle(spinnerCases.classic),
);

test('does not write spinner control characters to redirected output', () => {
  const redirected = output(false);
  const spinner = new TerminalSpinner(redirected);

  spinner.start(label);
  spinner.stop();

  assert.deepEqual(redirected.writes, []);
});

test('validates spinner style options and defaults to Classic', () => {
  assert.equal(terminalSpinnerStyle(undefined), 'classic');
  for (const { style } of Object.values(spinnerCases))
    assert.equal(terminalSpinnerStyle(style), style);
  assert.throws(() => terminalSpinnerStyle('dots'), /use braille or classic/);
});

test('loads a supported spinner style from the source-controlled defaults', async () => {
  const defaults = JSON.parse(
    await readFile(new URL('../../config/defaults.json', import.meta.url), 'utf8'),
  ) as { developmentConfig?: { terminalSpinnerStyle?: string } };

  const configuredStyle = defaults.developmentConfig?.terminalSpinnerStyle;
  assert.ok(configuredStyle);
  assert.equal(terminalSpinnerStyle(configuredStyle), configuredStyle);
});