/**
 * Models indexed repository branches and detects differences in historical remote runs.
 */

export interface IndexedBranches {
  path: string;
  tests: string;
}

export interface RemoteBranches {
  pathBranch: string;
  testsBranch: string;
}

export type BranchDifference = 'path' | 'tests';

export interface RemoteBranchOption {
  value: string;
  currentLocal: boolean;
}

export interface RemoteBranchPresetOption {
  preset: Exclude<RemoteBranchPreset, 'custom'>;
  label: string;
  title: string;
}

export interface SavedRemoteSettings extends RemoteBranches {
  jobName?: string;
  userSuffix?: string;
}

export interface RemoteSettings extends RemoteBranches {
  jobName: string;
  userSuffix: string;
}

export type RemoteBranchPreset = 'local' | 'develop' | 'custom';

export const remoteBranchOptions = (localBranch: string): RemoteBranchOption[] => {
  const currentLocal = localBranch.trim();
  return [
    { value: 'develop', currentLocal: false },
    ...(currentLocal && currentLocal !== 'develop'
      ? [{ value: currentLocal, currentLocal: true }]
      : []),
  ];
};

export const restoreRemoteSettings = <T extends RemoteSettings>(
  current: T,
  saved: SavedRemoteSettings,
): T => {
  const restored = {
    ...current,
    pathBranch: saved.pathBranch,
    testsBranch: saved.testsBranch,
    jobName: saved.jobName || current.jobName,
    userSuffix: saved.userSuffix || current.userSuffix,
  };
  return restored.pathBranch === current.pathBranch &&
    restored.testsBranch === current.testsBranch &&
    restored.jobName === current.jobName &&
    restored.userSuffix === current.userSuffix
    ? current
    : restored;
};

export const resetRemoteBranchesToLocal = <T extends RemoteBranches>(
  current: T,
  local: IndexedBranches,
): T => {
  if (current.pathBranch === local.path && current.testsBranch === local.tests) return current;
  return { ...current, pathBranch: local.path, testsBranch: local.tests };
};

export const followLocalBranchCheckout = <T extends RemoteBranches>(
  current: T,
  previousLocal: IndexedBranches,
  nextLocal: IndexedBranches,
): T =>
  differingBranches(current, previousLocal).length === 0
    ? resetRemoteBranchesToLocal(current, nextLocal)
    : current;

export const remoteBranchPreset = (
  remote: RemoteBranches,
  local: IndexedBranches,
): RemoteBranchPreset => {
  if (differingBranches(remote, local).length === 0) return 'local';
  if (remote.pathBranch.trim() === 'develop' && remote.testsBranch.trim() === 'develop')
    return 'develop';
  return 'custom';
};

export const differingBranches = (
  remote: RemoteBranches,
  indexed: IndexedBranches,
): BranchDifference[] => {
  const differences: BranchDifference[] = [];
  if (remote.pathBranch.trim() !== indexed.path.trim()) differences.push('path');
  if (remote.testsBranch.trim() !== indexed.tests.trim()) differences.push('tests');
  return differences;
};

export const remoteBranchPresetOptions = (
  local: IndexedBranches,
): RemoteBranchPresetOption[] => {
  const pathBranch = local.path.trim();
  const testsBranch = local.tests.trim();
  const localTitle = `PATH: ${pathBranch || 'unknown'}\nTEST: ${testsBranch || 'unknown'}`;
  const localOption: RemoteBranchPresetOption = {
    preset: 'local',
    label: pathBranch === 'develop' && testsBranch === 'develop' ? 'develop' : 'local: feature',
    title: localTitle,
  };
  return pathBranch === 'develop' && testsBranch === 'develop'
    ? [localOption]
    : [localOption, { preset: 'develop', label: 'develop', title: 'PATH: develop\nTEST: develop' }];
};
