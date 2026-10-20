/**
 * Renders the searchable History side panel using records and pure history-view helpers.
 */

import { useMemo, useState } from 'react';
import { groupRemoteHistoryByBranches, type HistoryRecord } from './history';
import {
  filterHistoryRecords,
  groupHistoryRecords,
  type HistoryStatusFilter,
  type HistoryViewRun,
} from './history-view';
import { runStatusLabel, type StatusRun } from './run-status';
import { testSuiteIdentity, type TestSuiteStage } from './title';
import styles from './history-panel.module.css';

const stageStyles: Record<TestSuiteStage, string> = {
  DEV: styles.stageDev,
  QA: styles.stageQa,
  UAT: styles.stageUat,
  PROD: styles.stageProd,
  STAGE: styles.stageStage,
};

const statusFilters: Array<{ value: HistoryStatusFilter; label: string }> = [
  { value: 'passed', label: 'Passed' },
  { value: 'failed', label: 'Failed' },
  { value: 'incomplete', label: 'Incomplete' },
];

interface HistoryRun extends HistoryViewRun, StatusRun {
  id: string;
}

interface HistoryPanelProps<T extends HistoryRun> {
  records: HistoryRecord<T>[];
  onLoad: (record: HistoryRecord<T>) => void;
}

export function HistoryPanel<T extends HistoryRun>({ records, onLoad }: HistoryPanelProps<T>) {
  const [historyQuery, setHistoryQuery] = useState('');
  const [selectedStatuses, setSelectedStatuses] = useState<HistoryStatusFilter[]>([]);
  const filteredRecords = useMemo(
    () => filterHistoryRecords(records, historyQuery, selectedStatuses),
    [records, historyQuery, selectedStatuses],
  );
  const grouped = useMemo(() => groupHistoryRecords(filteredRecords), [filteredRecords]);
  const normalizedQuery = historyQuery.trim();
  const historyRunButtons = (runRecords: HistoryRecord<T>[]) => (
    <div className={styles.runList}>
      {runRecords.map((record) => (
        <button
          className={styles.runButton}
          onClick={() => onLoad(record)}
          key={record.id}
          title={'Load ' + record.suiteName + ' in Runner'}
        >
          <span className={styles.runDetails}>
            <time className={styles.runTime} dateTime={record.startedAt}>
              {new Date(record.startedAt).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
              })}
            </time>
            <small className={styles.testNames}>
              {record.testNames.length ? record.testNames.join(', ') : 'Entire test suite'}
            </small>
          </span>
          <span className={`${styles.status} ${styles[record.run.status] || ''}`}>
            {runStatusLabel(record.run, record.output)}
          </span>
        </button>
      ))}
    </div>
  );
  const historySuiteLabel = (suite: string, suiteFile?: string) => {
    const identity = testSuiteIdentity(suite, suiteFile);
    return (
      <strong className={styles.suiteLabel} title={suite} aria-label={suite}>
        {identity.tenant && identity.stage && (
          <span className={styles.environmentBadges} aria-hidden="true">
            <span className={`${styles.environmentBadge} ${styles.tenantBadge}`}>
              {identity.tenant}
            </span>
            <span
              className={`${styles.environmentBadge} ${styles.stageBadge} ${stageStyles[identity.stage]}`}
            >
              {identity.stage}
            </span>
          </span>
        )}
        <span className={styles.suiteDisplayName}>{identity.displayName}</span>
      </strong>
    );
  };

  return (
    <section className={styles.page} data-side-panel-content>
      <div className={styles.header}>
        <h2 className={styles.heading}>RUN HISTORY</h2>
        <small className={styles.runCount}>
          {filteredRecords.length} run{filteredRecords.length !== 1 && 's'}
        </small>
      </div>
      <div className={styles.search}>
        <span className={styles.searchIcon} aria-hidden="true">
          ⌕
        </span>
        <input
          value={historyQuery}
          onChange={(event) => setHistoryQuery(event.target.value)}
          placeholder="Search Test Suite, Test Case, or filename…"
        />
        {historyQuery && (
          <button onClick={() => setHistoryQuery('')} aria-label="Clear history search">
            ×
          </button>
        )}
      </div>
      <div className={styles.statusFilters} role="group" aria-label="Filter run history by status">
        {statusFilters.map(({ value, label }) => (
          <button
            type="button"
            className={`${styles.statusFilter} ${selectedStatuses.includes(value) ? styles.statusFilterActive : ''}`}
            aria-pressed={selectedStatuses.includes(value)}
            onClick={() =>
              setSelectedStatuses((current) =>
                current.includes(value)
                  ? current.filter((status) => status !== value)
                  : [...current, value],
              )
            }
            key={value}
          >
            {label}
          </button>
        ))}
        <button
          type="button"
          className={styles.resetFilter}
          disabled={!selectedStatuses.length}
          onClick={() => setSelectedStatuses([])}
          title="Clear status filters"
        >
          Reset
        </button>
      </div>
      <div className={styles.tree}>
        {!filteredRecords.length ? (
          <div className={styles.empty}>
            {records.length ? 'No matching run history.' : 'No saved runs yet.'}
          </div>
        ) : (
          grouped.map(([date, suites]) => (
            <details className={`${styles.disclosure} ${styles.date}`} open key={date}>
              <summary className={`${styles.summary} ${styles.topSummary}`}>
                <span className={styles.foldSymbol} />
                <strong className={styles.dateLabel}>{date}</strong>
                <small className={styles.dateCount}>
                  {[...suites.values()].reduce(
                    (count, kinds) => count + kinds.local.length + kinds.remote.length,
                    0,
                  )}
                </small>
              </summary>
              <div className={styles.dateBody}>
                {[...suites.entries()].map(([suite, kinds]) => (
                  <details
                    className={`${styles.disclosure} ${styles.suite}`}
                    key={suite}
                    open={Boolean(normalizedQuery)}
                  >
                    <summary className={`${styles.summary} ${styles.topSummary}`}>
                      <span className={styles.foldSymbol} />
                      {historySuiteLabel(
                        suite,
                        (kinds.local[0] || kinds.remote[0])?.suiteFile,
                      )}
                    </summary>
                    <div className={styles.suiteBody}>
                      {(['local', 'remote'] as const).map(
                        (kind) =>
                          kinds[kind].length > 0 && (
                            <details
                              className={`${styles.disclosure} ${styles.kind}`}
                              key={kind}
                              open
                            >
                              <summary className={`${styles.summary} ${styles.kindSummary}`}>
                                <span className={styles.foldSymbol} />
                                <h3 className={styles.kindHeading}>
                                  {kind === 'local' ? 'Local PowerShell' : 'Remote Pod'}{' '}
                                  <span className={styles.kindCount}>{kinds[kind].length}</span>
                                </h3>
                              </summary>
                              {kind === 'local' ? (
                                historyRunButtons(kinds.local)
                              ) : (
                                <div className={styles.branchSets}>
                                  {groupRemoteHistoryByBranches(kinds.remote).map((branchSet) => (
                                    <details
                                      className={`${styles.disclosure} ${styles.branchSet}`}
                                      key={branchSet.key}
                                      open
                                    >
                                      <summary className={`${styles.summary} ${styles.branchSummary}`}>
                                        <span className={styles.foldSymbol} />
                                        <span className={styles.branchNames}>
                                          <strong
                                            className={styles.branchName}
                                            title={branchSet.pathBranch}
                                          >
                                            PATH: {branchSet.pathBranch}
                                          </strong>
                                          <strong
                                            className={styles.branchName}
                                            title={branchSet.testsBranch}
                                          >
                                            TEST: {branchSet.testsBranch}
                                          </strong>
                                        </span>
                                        <span className={styles.branchCount}>
                                          {branchSet.records.length}
                                        </span>
                                      </summary>
                                      <div>{historyRunButtons(branchSet.records)}</div>
                                    </details>
                                  ))}
                                </div>
                              )}
                            </details>
                          ),
                      )}
                    </div>
                  </details>
                ))}
              </div>
            </details>
          ))
        )}
      </div>
    </section>
  );
}
