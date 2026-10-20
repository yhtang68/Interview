/**
 * Verifies live-run and History-preview selection behavior plus remote branch grouping.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  correctedHistoryRecord,
  groupRemoteHistoryByBranches,
  historySelectionTarget,
  matchingSuiteHistory,
  type HistoryRecord,
} from '../../src/history.js';

test('History correction preserves incomplete stopped runs', () => {
  const record: HistoryRecord<{ status: string; exitCode: number | null }> = {
    id: 'local:stopped',
    kind: 'local',
    startedAt: '2026-08-21T12:00:00Z',
    endedAt: '2026-08-21T12:01:00Z',
    suiteName: 'StoppedSuite',
    suiteFile: 'StoppedSuite.yaml',
    testNames: [],
    run: { status: 'incomplete', exitCode: null },
    output: 'Failed: 1\nRun Status: Failures',
  };

  assert.equal(correctedHistoryRecord(record), record);
});

test('replaces the current trace when no run is active', () => {
  assert.equal(historySelectionTarget(null, 'saved'), 'replace');
  assert.equal(historySelectionTarget({ id: 'finished', status: 'passed' }, 'saved'), 'replace');
});

test('returns to the live trace when its History entry is selected', () => {
  assert.equal(historySelectionTarget({ id: 'active', status: 'running' }, 'active'), 'live');
});

test('archives a History preview without replacing an active run', () => {
  assert.equal(historySelectionTarget({ id: 'active', status: 'running' }, 'saved'), 'archive');
});

test('loads every run from the matching date, suite, and kind in newest-to-oldest order', () => {
  const record = (
    id: string,
    startedAt: string,
    suiteName = 'AccountSuite',
    kind: HistoryRecord<{ id: string; pathBranch?: string; testsBranch?: string }>['kind'] =
      'local',
  ): HistoryRecord<{ id: string; pathBranch?: string; testsBranch?: string }> => ({
    id: `${kind}:${id}`,
    kind,
    startedAt,
    endedAt: startedAt,
    suiteName,
    suiteFile: `${suiteName}.yaml`,
    testNames: [],
    run: { id },
    output: id,
  });
  const selected = record('middle', '2026-08-17T13:00:00');
  const records = [
    selected,
    record('other-kind', '2026-08-17T16:00:00', 'AccountSuite', 'remote'),
    record('oldest', '2026-08-17T12:00:00'),
    record('previous-day', '2026-08-16T12:00:00'),
    record('other-suite', '2026-08-17T17:00:00', 'AssetSuite'),
    record('newest', '2026-08-17T14:00:00'),
  ];

  assert.deepEqual(
    matchingSuiteHistory(records, selected).map((item) => item.run.id),
    ['newest', 'middle', 'oldest'],
  );
});

test('groups Remote Pod history by PATH and Test repository branches', () => {
  const record = (
    id: string,
    pathBranch?: string,
    testsBranch?: string,
  ): HistoryRecord<{ id: string; pathBranch?: string; testsBranch?: string }> => ({
    id: `remote:${id}`,
    kind: 'remote',
    startedAt: `2026-08-18T12:00:0${id}Z`,
    endedAt: '',
    suiteName: 'AccountSuite',
    suiteFile: 'AccountSuite.yaml',
    testNames: [],
    run: { id, pathBranch, testsBranch },
    output: '',
  });
  const groups = groupRemoteHistoryByBranches([
    record('1', 'develop', 'feature/tests'),
    record('2', 'develop', 'feature/tests'),
    record('3', 'release', 'develop'),
    record('4'),
  ]);

  assert.deepEqual(
    groups.map(({ pathBranch, testsBranch, records }) => ({
      pathBranch,
      testsBranch,
      records: records.map((item) => item.run.id),
    })),
    [
      { pathBranch: 'develop', testsBranch: 'feature/tests', records: ['1', '2'] },
      { pathBranch: 'release', testsBranch: 'develop', records: ['3'] },
      { pathBranch: 'Not recorded', testsBranch: 'Not recorded', records: ['4'] },
    ],
  );
});

test('limits Remote Pod trace pages to the selected branch set', () => {
  const record = (
    id: string,
    pathBranch: string,
  ): HistoryRecord<{ id: string; pathBranch: string; testsBranch: string }> => ({
    id: `remote:${id}`,
    kind: 'remote',
    startedAt: `2026-08-18T12:00:0${id}Z`,
    endedAt: '',
    suiteName: 'AccountSuite',
    suiteFile: 'AccountSuite.yaml',
    testNames: [],
    run: { id, pathBranch, testsBranch: 'develop' },
    output: '',
  });
  const selected = record('2', 'feature/path');

  assert.deepEqual(
    matchingSuiteHistory(
      [record('1', 'develop'), selected, record('3', 'feature/path')],
      selected,
    ).map((item) => item.run.id),
    ['3', '2'],
  );
});