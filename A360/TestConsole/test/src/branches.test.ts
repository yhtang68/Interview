/**
 * Verifies comparison of indexed repository branches with historical remote-run branches.
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  differingBranches,
  followLocalBranchCheckout,
  remoteBranchOptions,
  remoteBranchPreset,
  remoteBranchPresetOptions,
  resetRemoteBranchesToLocal,
  restoreRemoteSettings,
} from '../../src/branches.js';

test('finds remote branches that differ from the current Test Index', () => {
  assert.deepEqual(
    differingBranches(
      { pathBranch: 'develop', testsBranch: 'ATANG/TRAD-19018' },
      { path: 'ATANG/TRAD-19018', tests: 'ATANG/TRAD-19018' },
    ),
    ['path'],
  );
});

test('ignores surrounding whitespace when comparing branch values', () => {
  assert.deepEqual(
    differingBranches(
      { pathBranch: ' develop ', testsBranch: 'feature/test ' },
      { path: 'develop', tests: 'feature/test' },
    ),
    [],
  );
});

test('offers develop and identifies a feature branch as Current local', () => {
  assert.deepEqual(remoteBranchOptions('ATANG/TRAD-19018'), [
    { value: 'develop', currentLocal: false },
    { value: 'ATANG/TRAD-19018', currentLocal: true },
  ]);
});

test('does not duplicate or tag develop when it is also the local branch', () => {
  assert.deepEqual(remoteBranchOptions(' develop '), [
    { value: 'develop', currentLocal: false },
  ]);
});

test('History restoration preserves arbitrary saved Remote Pod branches', () => {
  const current = {
    pathBranch: 'develop',
    testsBranch: 'develop',
    jobName: 'trading-develop-atang',
    userSuffix: 'atang',
    browser: 'chrome',
  };

  assert.deepEqual(
    restoreRemoteSettings(current, {
      pathBranch: 'release/path-2026.08',
      testsBranch: 'feature/historical-tests',
      jobName: 'historical-job',
      userSuffix: 'history-user',
    }),
    {
      ...current,
      pathBranch: 'release/path-2026.08',
      testsBranch: 'feature/historical-tests',
      jobName: 'historical-job',
      userSuffix: 'history-user',
    },
  );
});

test('History restoration preserves current metadata when older records omit it', () => {
  const current = {
    pathBranch: 'develop',
    testsBranch: 'develop',
    jobName: 'current-job',
    userSuffix: 'current-user',
  };

  assert.deepEqual(
    restoreRemoteSettings(current, {
      pathBranch: 'saved/path',
      testsBranch: 'saved/tests',
    }),
    {
      ...current,
      pathBranch: 'saved/path',
      testsBranch: 'saved/tests',
    },
  );
});

test('returning to Runner resets only Remote Pod branches to Current local', () => {
  const historySettings = {
    pathBranch: 'develop',
    testsBranch: 'develop',
    jobName: 'historical-job',
    userSuffix: 'history-user',
    browser: 'config',
    logDir: 'custom-log',
    allure: true,
  };

  assert.deepEqual(
    resetRemoteBranchesToLocal(historySettings, {
      path: 'ATANG/local-path-feature',
      tests: 'ATANG/local-tests-feature',
    }),
    {
      ...historySettings,
      pathBranch: 'ATANG/local-path-feature',
      testsBranch: 'ATANG/local-tests-feature',
    },
  );
});

test('returning to Runner preserves settings identity when branches are already local', () => {
  const localSettings = {
    pathBranch: 'ATANG/local-path-feature',
    testsBranch: 'ATANG/local-tests-feature',
    jobName: 'unchanged-job',
    userSuffix: 'atang',
  };

  assert.equal(
    resetRemoteBranchesToLocal(localSettings, {
      path: localSettings.pathBranch,
      tests: localSettings.testsBranch,
    }),
    localSettings,
  );
});

test('Remote Pod branches follow a live checkout while using Current local', () => {
  const current = {
    pathBranch: 'feature/old-path',
    testsBranch: 'feature/old-tests',
    jobName: 'unchanged-job',
  };
  const nextLocal = { path: 'develop', tests: 'develop' };
  const followed = followLocalBranchCheckout(
    current,
    { path: 'feature/old-path', tests: 'feature/old-tests' },
    nextLocal,
  );

  assert.deepEqual(followed, { ...current, pathBranch: 'develop', testsBranch: 'develop' });
  assert.deepEqual(differingBranches(followed, nextLocal), []);
});

test('live checkout preserves explicit develop branches', () => {
  const current = {
    pathBranch: 'develop',
    testsBranch: 'develop',
    jobName: 'develop-job',
  };

  assert.equal(
    followLocalBranchCheckout(
      current,
      { path: 'feature/old-path', tests: 'feature/old-tests' },
      { path: 'feature/new-path', tests: 'feature/new-tests' },
    ),
    current,
  );
});

test('live checkout preserves custom or History branch values', () => {
  const current = {
    pathBranch: 'release/saved-path',
    testsBranch: 'feature/saved-tests',
    jobName: 'historical-job',
  };

  assert.equal(
    followLocalBranchCheckout(
      current,
      { path: 'feature/old-path', tests: 'feature/old-tests' },
      { path: 'develop', tests: 'develop' },
    ),
    current,
  );
});

test('identifies the Current local branch preset', () => {
  assert.equal(
    remoteBranchPreset(
      { pathBranch: 'feature/path', testsBranch: 'feature/tests' },
      { path: 'feature/path', tests: 'feature/tests' },
    ),
    'local',
  );
});

test('identifies the develop branch preset', () => {
  assert.equal(
    remoteBranchPreset(
      { pathBranch: 'develop', testsBranch: 'develop' },
      { path: 'feature/path', tests: 'feature/tests' },
    ),
    'develop',
  );
});

test('identifies mixed and manually entered branches as custom values', () => {
  assert.equal(
    remoteBranchPreset(
      { pathBranch: 'develop', testsBranch: 'release/tests' },
      { path: 'feature/path', tests: 'feature/tests' },
    ),
    'custom',
  );
});

test('offers local feature and develop Remote Pod presets', () => {
  assert.deepEqual(
    remoteBranchPresetOptions({ path: 'ATANG/TRAD-19018', tests: 'ATANG/TRAD-19018' }),
    [
      {
        preset: 'local',
        label: 'local: feature',
        title: 'PATH: ATANG/TRAD-19018\nTEST: ATANG/TRAD-19018',
      },
      { preset: 'develop', label: 'develop', title: 'PATH: develop\nTEST: develop' },
    ],
  );
});

test('collapses the Remote Pod preset when both local branches are develop', () => {
  assert.deepEqual(remoteBranchPresetOptions({ path: ' develop ', tests: 'develop' }), [
    { preset: 'local', label: 'develop', title: 'PATH: develop\nTEST: develop' },
  ]);
});

test('uses the local feature preset when repository branch names differ', () => {
  assert.deepEqual(
    remoteBranchPresetOptions({ path: 'feature/path', tests: 'feature/tests' }),
    [
      {
        preset: 'local',
        label: 'local: feature',
        title: 'PATH: feature/path\nTEST: feature/tests',
      },
      { preset: 'develop', label: 'develop', title: 'PATH: develop\nTEST: develop' },
    ],
  );
});
