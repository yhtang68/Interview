/**
 * Verifies TestConsole development-log location, timestamps, and terminal cleanup.
 */

import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  DevelopmentLog,
  developmentLogPath,
  formatDevelopmentMessage,
} from '../../scripts/development-log.js';

const timestamp = new Date(2026, 7, 21, 13, 4, 5, 6);

test('uses the Windows user-local TestConsole log directory and daily filename', () => {
  assert.equal(
    developmentLogPath(timestamp, 'C:\\Users\\person\\AppData\\Local'),
    path.join(
      'C:\\Users\\person\\AppData\\Local',
      'A360',
      'PATH',
      'TestConsole',
      'logs',
      'test-console-2026-08-21.log',
    ),
  );
});

test('formats full local date and time with milliseconds', () => {
  assert.equal(
    formatDevelopmentMessage('API', 'Catalog ready.', timestamp),
    '[2026-08-21 13:04:05.006] [API] Catalog ready.\n',
  );
});

test('persists output without terminal color controls', () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'test-console-log-'));
  const file = path.join(directory, 'development.log');
  try {
    const log = new DevelopmentLog(file);
    log.append('\u001b[35m[API]\u001b[0m ready\n');
    assert.equal(readFileSync(file, 'utf8'), '[API] ready\n');
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});