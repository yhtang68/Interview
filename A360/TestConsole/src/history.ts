/**
 * Defines run-history records, IndexedDB persistence, and branch grouping without React UI.
 */

const DATABASE_NAME = 'path-test-console';
const DATABASE_VERSION = 1;
const STORE_NAME = 'run-history';
const MAX_RECORDS_PER_KIND = 50;

export interface HistoryRecord<T> {
  id: string;
  kind: 'local' | 'remote';
  startedAt: string;
  endedAt: string;
  suiteName: string;
  suiteFile: string;
  testNames: string[];
  testCodeCommit?: string;
  appCommit?: string;
  run: T;
  output: string;
}

interface BranchAwareRun {
  pathBranch?: string;
  testsBranch?: string;
}

interface CorrectableRun {
  status: string;
  exitCode: number | null;
}

export interface RemoteBranchSet<T> {
  key: string;
  pathBranch: string;
  testsBranch: string;
  records: HistoryRecord<T>[];
}

const branchSetValues = (run: BranchAwareRun) => ({
  pathBranch: run.pathBranch?.trim() || 'Not recorded',
  testsBranch: run.testsBranch?.trim() || 'Not recorded',
});

const branchSetKey = (run: BranchAwareRun) => {
  const branches = branchSetValues(run);
  return branches.pathBranch + '\u0000' + branches.testsBranch;
};

export const groupRemoteHistoryByBranches = <T extends BranchAwareRun>(
  records: HistoryRecord<T>[],
): RemoteBranchSet<T>[] => {
  const groups = new Map<string, RemoteBranchSet<T>>();
  for (const record of records) {
    const key = branchSetKey(record.run);
    const existing = groups.get(key);
    if (existing) existing.records.push(record);
    else groups.set(key, { key, ...branchSetValues(record.run), records: [record] });
  }
  return [...groups.values()];
};

export type HistorySelectionTarget = 'replace' | 'live' | 'archive';

export const historySelectionTarget = (
  currentRun: { id: string; status: string } | null,
  selectedRunId: string,
): HistorySelectionTarget => {
  if (currentRun?.status !== 'running') return 'replace';
  return currentRun.id === selectedRunId ? 'live' : 'archive';
};

export const matchingSuiteHistory = <T extends BranchAwareRun>(
  records: HistoryRecord<T>[],
  selected: Pick<HistoryRecord<T>, 'kind' | 'suiteName' | 'startedAt' | 'run'>,
): HistoryRecord<T>[] => {
  const selectedDate = new Date(selected.startedAt).toDateString();
  const selectedBranchSet = selected.kind === 'remote' ? branchSetKey(selected.run) : '';
  return records
    .filter(
      (record) =>
        record.kind === selected.kind &&
        record.suiteName === selected.suiteName &&
        new Date(record.startedAt).toDateString() === selectedDate &&
        (record.kind !== 'remote' || branchSetKey(record.run) === selectedBranchSet),
    )
    .sort((left, right) => right.startedAt.localeCompare(left.startedAt));
};

export const correctedHistoryRecord = <T extends CorrectableRun>(
  record: HistoryRecord<T>,
): HistoryRecord<T> => {
  if (record.kind !== 'local' || record.run.status !== 'passed') return record;
  const plainOutput = record.output.replace(/\u001b\[[0-9;]*m/g, '');
  const failedCount = [...plainOutput.matchAll(/\bFailed\s*:\s*(\d+)\b/gi)].at(-1);
  const runStatus = [...plainOutput.matchAll(/\bRun Status\s*:\s*([^\r\n*]+)/gi)]
    .at(-1)?.[1]
    ?.trim()
    .toLowerCase();
  const failed =
    (failedCount && Number(failedCount[1]) > 0) ||
    (runStatus && /failure|failed|error/.test(runStatus));
  return failed
    ? {
        ...record,
        run: {
          ...record.run,
          status: 'failed',
          exitCode: record.run.exitCode === 0 ? 1 : record.run.exitCode,
        },
      }
    : record;
};

const requestResult = <T>(request: IDBRequest<T>) =>
  new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

const openHistoryDatabase = () =>
  new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const store = database.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('kind', 'kind');
        store.createIndex('startedAt', 'startedAt');
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

const withStore = async <T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> => {
  const database = await openHistoryDatabase();
  try {
    return await requestResult(
      operation(database.transaction(STORE_NAME, mode).objectStore(STORE_NAME)),
    );
  } finally {
    database.close();
  }
};

export const loadRunHistory = async <T>(): Promise<HistoryRecord<T>[]> => {
  const records = (await withStore('readonly', (store) => store.getAll())) as HistoryRecord<T>[];
  return records.sort((left, right) => right.startedAt.localeCompare(left.startedAt));
};

export const pruneRunHistory = async <T>(retentionDays: number): Promise<HistoryRecord<T>[]> => {
  const records = await loadRunHistory<T>();
  const safeDays = Number.isFinite(retentionDays)
    ? Math.min(14, Math.max(1, Math.floor(retentionDays)))
    : 7;
  const cutoff = Date.now() - safeDays * 24 * 60 * 60 * 1000;
  const expired = records.filter((record) => {
    const startedAt = Date.parse(record.startedAt);
    return Number.isFinite(startedAt) && startedAt < cutoff;
  });
  await Promise.all(expired.map((record) => deleteRunHistory(record.id)));
  const expiredIds = new Set(expired.map((record) => record.id));
  return records.filter((record) => !expiredIds.has(record.id));
};

export const saveRunHistory = async <T>(record: HistoryRecord<T>): Promise<void> => {
  await withStore('readwrite', (store) => store.put(record));
  const records = await loadRunHistory<T>();
  const excess = records.filter((item) => item.kind === record.kind).slice(MAX_RECORDS_PER_KIND);
  await Promise.all(excess.map((item) => deleteRunHistory(item.id)));
};

export const deleteRunHistory = async (id: string): Promise<void> => {
  await withStore('readwrite', (store) => store.delete(id));
};
