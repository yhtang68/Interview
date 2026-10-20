/**
 * Verifies that the stop command recognizes only API and Vite processes from this project.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { isTestConsoleProcess } from '../../scripts/stop.js';

const root = 'C:\\PATH_Project\\TRAD-Test-Automation\\TestConsole';

test('recognizes the TestConsole API listener', () => {
  assert.equal(
    isTestConsoleProcess(
      `node --import ${root}\\node_modules\\tsx\\dist\\loader.mjs ${root}\\server\\index.ts`,
      root,
    ),
    true,
  );
  assert.equal(
    isTestConsoleProcess(
      `node --import ${root}\\node_modules\\tsx\\dist\\loader.mjs server\\index.ts`,
      root,
    ),
    true,
  );
});

test('recognizes the TestConsole Vite listener', () => {
  assert.equal(
    isTestConsoleProcess(`node ${root}\\node_modules\\vite\\bin\\vite.js`, root),
    true,
  );
});

test('refuses unrelated and differently rooted processes', () => {
  assert.equal(isTestConsoleProcess(`node ${root}\\scripts\\unrelated.ts`, root), false);
  assert.equal(
    isTestConsoleProcess('node C:\\another-project\\node_modules\\vite\\bin\\vite.js', root),
    false,
  );
  assert.equal(isTestConsoleProcess(null, root), false);
});
