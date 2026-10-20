/**
 * Verifies selected-test and browser settings for local CLI and remote YAML execution.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { localDriverArgs, testCaseArgs, testCasesYaml } from '../../server/run-selection.js';

test('suite-only local runs omit the test-cases filter', () => {
  assert.deepEqual(testCaseArgs([]), []);
});

test('selected local cases produce the test-cases filter', () => {
  assert.deepEqual(testCaseArgs(['CaseOne', 'CaseTwo']), ['--test-cases', 'CaseOne', 'CaseTwo']);
});

test('suite-only remote runs omit TESTCASES YAML', () => {
  assert.equal(testCasesYaml([]), '');
});

test('selected remote cases produce an INCLUDE list', () => {
  assert.equal(
    testCasesYaml(['CaseOne', 'CaseTwo']),
    '    TESTCASES:\n      INCLUDE:\n        - CaseOne\n        - CaseTwo\n',
  );
});

test('config browser mode omits the localdriver override', () => {
  assert.deepEqual(localDriverArgs('config'), []);
});

test('local browser mode adds the localdriver override', () => {
  assert.deepEqual(localDriverArgs('chrome'), ['--localdriver', 'chrome']);
});
