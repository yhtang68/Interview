/**
 * Provides pure History filtering and date/suite/run grouping for history-panel.tsx.
 */

import type { HistoryRecord } from './history';

export interface HistoryViewRun {
  status: string;
  pathBranch?: string;
  testsBranch?: string;
}

export const historyStatusFilters = ['passed', 'failed', 'incomplete'] as const;
export type HistoryStatusFilter = (typeof historyStatusFilters)[number];
export type HistoryKinds<T> = Record<'local' | 'remote', HistoryRecord<T>[]>;
export type GroupedHistory<T> = Array<[string, Map<string, HistoryKinds<T>>]>;

export const filterHistoryRecords = <T extends HistoryViewRun>(
  records: HistoryRecord<T>[],
  query: string,
  statuses: readonly HistoryStatusFilter[] = [],
) => {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery && !statuses.length) return records;
  return records.filter((record) => {
    if (
      record.run.status !== 'running' &&
      statuses.length &&
      !statuses.includes(record.run.status as HistoryStatusFilter)
    )
      return false;
    return (
      !normalizedQuery ||
      [
        record.suiteName,
        record.suiteFile,
        ...record.testNames,
        record.run.pathBranch || '',
        record.run.testsBranch || '',
      ].some((value) => value.toLowerCase().includes(normalizedQuery))
    );
  });
};

export const groupHistoryRecords = <T>(records: HistoryRecord<T>[]): GroupedHistory<T> => {
  const dates = new Map<string, Map<string, HistoryKinds<T>>>();
  for (const record of records) {
    const date = new Date(record.startedAt).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    if (!dates.has(date)) dates.set(date, new Map());
    const suites = dates.get(date)!;
    if (!suites.has(record.suiteName)) suites.set(record.suiteName, { local: [], remote: [] });
    suites.get(record.suiteName)![record.kind].push(record);
  }
  return [...dates.entries()];
};
