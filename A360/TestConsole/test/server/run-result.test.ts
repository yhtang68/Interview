/**
 * Verifies local-run pass/fail interpretation from process results and PATH output.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { localRunResult } from '../../server/run-result.js';

test('PATH failure summary overrides a zero process exit code', () => {
  assert.deepEqual(localRunResult('Passed: 0\nFailed: 1\nRun Status: Failures', 0), {
    status: 'failed',
    exitCode: 1,
  });
});

test('ANSI-colored failure status is detected', () => {
  assert.deepEqual(localRunResult('\u001b[91mRun Status: Failures\u001b[0m', 0), {
    status: 'failed',
    exitCode: 1,
  });
});

test('clean PATH summary remains passed', () => {
  assert.deepEqual(localRunResult('Passed: 1\nFailed: 0\nRun Status: Success', 0), {
    status: 'passed',
    exitCode: 0,
  });
});

test('nonzero process exit remains failed without a PATH summary', () => {
  assert.deepEqual(localRunResult('command error', 2), { status: 'failed', exitCode: 2 });
});

test('requested cancellation overrides the termination exit code', () => {
  assert.deepEqual(localRunResult('process terminated', 1, true), {
    status: 'cancelled',
    exitCode: null,
  });
});
