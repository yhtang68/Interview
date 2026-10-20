/**
 * Verifies formatting of elapsed startup time shown by the loading experience.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { formatStartupElapsed } from '../../src/startup.js';

test('formats startup elapsed time to tenths of a second', () => {
  assert.equal(formatStartupElapsed(0), '00:00.0');
  assert.equal(formatStartupElapsed(8_750), '00:08.7');
  assert.equal(formatStartupElapsed(65_432), '01:05.4');
});