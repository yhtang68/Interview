/**
 * Verifies the pure filtering and hierarchical grouping used by the History panel.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import type { HistoryRecord } from '../../src/history.js';
import { filterHistoryRecords, groupHistoryRecords } from '../../src/history-view.js';
import { runStatusLabel } from '../../src/run-status.js';

interface TestRun {
  id: string;
  kind: 'local' | 'remote';
  status: string;
  exitCode: number | null;
  httpStatus?: number;
  pathBranch?: string;
  testsBranch?: string;
}

const record = (
  id: string,
  overrides: Partial<HistoryRecord<TestRun>> = {},
): HistoryRecord<TestRun> => ({
  id: `local:${id}`,
  kind: 'local',
  startedAt: '2026-08-18T12:00:00Z',
  endedAt: '2026-08-18T12:01:00Z',
  suiteName: 'AccountSuite',
  suiteFile: 'configs/trading/AccountSuite.yaml',
  testNames: ['loads an account'],
  run: { id, kind: 'local', status: 'passed', exitCode: 0 },
  output: '',
  ...overrides,
});

test('History search matches suites, files, tests, and Remote Pod branches', () => {
  const local = record('local');
  const remote = record('remote', {
    id: 'remote:remote',
    kind: 'remote',
    suiteName: 'AssetSuite',
    suiteFile: 'configs/trading/AssetSuite.yaml',
    testNames: ['creates an asset'],
    run: {
      id: 'remote',
      kind: 'remote',
      status: 'failed',
      exitCode: 1,
      pathBranch: 'feature/path',
      testsBranch: 'feature/tests',
    },
  });
  const records = [local, remote];

  assert.deepEqual(filterHistoryRecords(records, ' account ').map(({ id }) => id), [local.id]);
  assert.deepEqual(filterHistoryRecords(records, 'AssetSuite.yaml').map(({ id }) => id), [remote.id]);
  assert.deepEqual(filterHistoryRecords(records, 'creates an asset').map(({ id }) => id), [remote.id]);
  assert.deepEqual(filterHistoryRecords(records, 'FEATURE/PATH').map(({ id }) => id), [remote.id]);
  assert.equal(filterHistoryRecords(records, ''), records);
});

test('History status filtering supports passed, failed, and incomplete runs', () => {
  const passed = record('passed');
  const failed = record('failed', {
    run: { id: 'failed', kind: 'local', status: 'failed', exitCode: 1 },
  });
  const incomplete = record('incomplete', {
    suiteName: 'StoppedSuite',
    run: { id: 'incomplete', kind: 'local', status: 'incomplete', exitCode: null },
  });
  const running = record('running', {
    run: { id: 'running', kind: 'local', status: 'running', exitCode: null },
  });
  const records = [passed, failed, incomplete, running];

  assert.equal(filterHistoryRecords(records, ''), records);
  assert.equal(filterHistoryRecords(records, '', []), records);
  assert.deepEqual(filterHistoryRecords(records, '', ['passed']).map(({ id }) => id), [
    passed.id,
    running.id,
  ]);
  assert.deepEqual(filterHistoryRecords(records, '', ['failed']).map(({ id }) => id), [
    failed.id,
    running.id,
  ]);
  assert.deepEqual(filterHistoryRecords(records, '', ['passed', 'failed']).map(({ id }) => id), [
    passed.id,
    failed.id,
    running.id,
  ]);
  assert.deepEqual(filterHistoryRecords(records, '', ['incomplete']).map(({ id }) => id), [
    incomplete.id,
    running.id,
  ]);
  assert.deepEqual(
    filterHistoryRecords(records, '', ['passed', 'failed', 'incomplete']).map(({ id }) => id),
    records.map(({ id }) => id),
  );
  assert.deepEqual(filterHistoryRecords(records, 'stopped', ['incomplete']).map(({ id }) => id), [
    incomplete.id,
  ]);
  assert.deepEqual(filterHistoryRecords(records, 'stopped', ['failed']), []);
});

test('History grouping preserves date, suite, kind, and record order', () => {
  const remote = record('remote', {
    id: 'remote:remote',
    kind: 'remote',
    run: { id: 'remote', kind: 'remote', status: 'passed', exitCode: 0 },
  });
  const otherSuite = record('asset', { suiteName: 'AssetSuite' });
  const groups = groupHistoryRecords([record('first'), remote, otherSuite]);
  const suites = groups[0][1];

  assert.deepEqual(suites.get('AccountSuite')?.local.map(({ run }) => run.id), ['first']);
  assert.deepEqual(suites.get('AccountSuite')?.remote.map(({ run }) => run.id), ['remote']);
  assert.deepEqual(suites.get('AssetSuite')?.local.map(({ run }) => run.id), ['asset']);
});

test('run status labels preserve local test counts and Remote Pod response codes', () => {
  assert.equal(
    runStatusLabel({ kind: 'local', status: 'passed', exitCode: 0 }, 'Passed: 12'),
    'Passed - Test (12)',
  );
  assert.equal(
    runStatusLabel({ kind: 'remote', status: 'failed', exitCode: 1, httpStatus: 500 }),
    'Failed - Response (500)',
  );
  assert.equal(runStatusLabel({ kind: 'remote', status: 'running', exitCode: null }), 'Running');
});
