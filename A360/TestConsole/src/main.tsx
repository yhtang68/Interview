/**
 * Composes the TestConsole application and coordinates API data, configuration, and run state.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import { AppHeader, type AppTheme } from './app-header';
import {
  differingBranches,
  followLocalBranchCheckout,
  resetRemoteBranchesToLocal,
  restoreRemoteSettings,
  type IndexedBranches,
} from './branches';
import { RemoteBranchFields } from './remote-branch-fields';
import { filterTestEntries, normalizeFilePath, shortPath } from './search';
import { formatStartupElapsed } from './startup';
import { testSuiteDocumentTitle } from './title';
import { HistoryPanel } from './history-panel';
import { runStatusLabel } from './run-status';
import { RunnerSearchPanel } from './runner-search-panel';
import { SidePanel } from './side-panel';
import { NavigationRail, type ActivePanel } from './navigation-rail';
import {
  correctedHistoryRecord,
  historySelectionTarget,
  matchingSuiteHistory,
  pruneRunHistory,
  saveRunHistory,
  type HistoryRecord,
} from './history';
interface TestEntry {
  name: string;
  file: string;
  base: string;
  line: number;
  relativeFile?: string;
  featureGroup?: string;
  configIds: string[];
}
interface ConfigEntry {
  name: string;
  suiteClass: string;
  file: string;
  relativeFile?: string;
  featureGroup?: string;
}
interface FeatureCatalog {
  tests: TestEntry[];
  configs: ConfigEntry[];
}
interface Catalog {
  groups: string[];
  features: Record<string, FeatureCatalog>;
  generatedAt: string;
}
interface Defaults {
  testSource: { featureGroup: string };
  podRunConfig: { userSuffix: string };
  historyConfig: { retentionDays: number };
  localRunConfig: { browser: string; logDir: string; allure: boolean };
}
interface Bootstrap {
  defaults: Defaults;
  branches: { path: string; tests: string };
  commits: { tests: string; app: string };
  user: { username: string; domain: string; identity: string };
  catalog: Catalog;
}
interface CatalogIndexProgress {
  phase: 'idle' | 'discovering' | 'indexing' | 'complete' | 'error';
  processedFiles: number;
  totalFiles: number;
  percentage: number;
}
interface SyncStatus {
  version: number;
  branches: IndexedBranches;
}
type SyncEvent =
  | ({ type: 'status' } & SyncStatus)
  | { type: 'catalog'; version: number }
  | { type: 'branches'; branches: IndexedBranches };
type RunKind = 'local' | 'remote';
interface Run {
  id: string;
  kind: RunKind;
  status: string;
  exitCode: number | null;
  startedAt?: string;
  endedAt?: string | null;
  requestUrl?: string;
  requestHeaders?: Record<string, string>;
  requestBody?: string;
  responseHeaders?: Record<string, string>;
  responseBody?: unknown;
  httpStatus?: number;
  pathBranch?: string;
  testsBranch?: string;
  jobName?: string;
  userSuffix?: string;
}
interface RunPage {
  run: Run;
  output: string;
}
interface RunMetadata {
  suiteName: string;
  suiteFile: string;
  testNames: string[];
}
type RunHistoryEntry = HistoryRecord<Run>;
interface Settings {
  browser: string;
  userSuffix: string;
  pathBranch: string;
  testsBranch: string;
  jobName: string;
  logDir: string;
  logoutAzure: boolean;
  allure: boolean;
}

const api = async <T,>(url: string, options?: RequestInit): Promise<T> => {
  const response = await fetch(url, {
    headers: { 'content-type': 'application/json' },
    ...options,
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || response.statusText);
  return data;
};

const formatRunDateTime = (value?: string) =>
  value
    ? new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'medium' })
    : 'Date and time unavailable';

const shortCommit = (value?: string) =>
  value && value !== 'unknown' ? value.slice(0, 10) : 'unavailable';

const testKey = (test: TestEntry) => test.name + '\u0000' + test.file;

const defaultJobName = (branchName: string, suffix: string) => {
  const ticket =
    branchName
      .split('/')
      .at(-1)
      ?.replace(/[^a-z0-9]+/gi, '-')
      .replace(/^-|-$/g, '')
      .toLowerCase() || 'develop';
  return `trading-${ticket}-${suffix || 'local'}`.replace(/-+/g, '-').slice(0, 63);
};

const ansiColors: Record<number, string> = {
  30: '#20252d',
  31: 'var(--ansi-red)',
  32: 'var(--ansi-green)',
  33: 'var(--ansi-yellow)',
  34: 'var(--ansi-blue)',
  35: '#d79aff',
  36: '#72d5e8',
  37: '#e6ebf1',
  90: '#8d98a6',
  91: 'var(--ansi-bright-red)',
  92: 'var(--ansi-bright-green)',
  93: 'var(--ansi-bright-yellow)',
  94: 'var(--ansi-bright-blue)',
  95: '#e7b4ff',
  96: '#9be8f2',
  97: '#ffffff',
};

function renderAnsi(text: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  const expression = /\u001b\[([0-9;]*)m/g;
  let cursor = 0;
  let style: React.CSSProperties = {};
  let match: RegExpExecArray | null;
  const append = (value: string) => {
    if (value)
      nodes.push(
        <span key={nodes.length} style={style}>
          {value}
        </span>,
      );
  };
  while ((match = expression.exec(text))) {
    append(text.slice(cursor, match.index));
    const codes = (match[1] || '0').split(';').map(Number);
    for (const code of codes) {
      if (code === 0) style = {};
      else if (code === 1) style = { ...style, fontWeight: 700 };
      else if (code === 22) {
        const { fontWeight: _fontWeight, ...rest } = style;
        style = rest;
      } else if (code === 39) {
        const { color: _color, ...rest } = style;
        style = rest;
      } else if (ansiColors[code]) style = { ...style, color: ansiColors[code] };
    }
    cursor = expression.lastIndex;
  }
  append(text.slice(cursor));
  return nodes;
}

function renderTrace(text: string): React.ReactNode[] {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  if (lines.length > 1 && lines.at(-1) === '') lines.pop();
  return lines.map((line, index) => (
    <span className="trace-line" key={index}>
      <span className="trace-line-number" aria-hidden="true">
        {index + 1}
      </span>
      <span className="trace-line-content">{line ? renderAnsi(line) : '\u00a0'}</span>
    </span>
  ));
}

function RemoteResponseView({ body, status }: { body: unknown; status?: number }) {
  const entries: Array<[string, unknown]> =
    body && typeof body === 'object' && !Array.isArray(body)
      ? Object.entries(body as Record<string, unknown>)
      : [['response', body]];
  return (
    <div className="remote-response">
      {status !== undefined && (
        <div className={`response-status ${status >= 200 && status < 300 ? 'success' : 'failure'}`}>
          <b>HTTP STATUS</b>
          <span>{status}</span>
        </div>
      )}
      <div className="response-fields">
        {entries.map(([key, value]) => {
          const text = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
          const isLink = typeof value === 'string' && /^https?:\/\//i.test(value);
          return (
            <div className="response-field" key={key}>
              <b>{key}</b>
              {isLink ? (
                <a href={value} target="_blank" rel="noopener noreferrer" title={value}>
                  {value}
                </a>
              ) : (
                <span>{text ?? 'null'}</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function HeaderFields({ headers }: { headers?: Record<string, string> }) {
  return (
    <div className="response-fields">
      {Object.entries(headers || {}).map(([key, value]) => (
        <div className="response-field" key={key}>
          <b>{key}</b>
          <span>{value}</span>
        </div>
      ))}
    </div>
  );
}

function RemoteTransactionView({ run }: { run: Run }) {
  return (
    <div className="remote-transaction">
      <details className="rest-fold">
        <summary>
          <span className="rest-fold-symbol" aria-hidden="true" />
          <b>REST REQUEST</b>
        </summary>
        <div className="rest-fold-body">
          {run.requestUrl && (
            <div className="request-target">
              <b>POST</b>
              <span title={run.requestUrl}>{run.requestUrl}</span>
            </div>
          )}
          <section className="rest-section">
            <h3>HEADERS</h3>
            <HeaderFields headers={run.requestHeaders} />
          </section>
          <section className="rest-section">
            <h3>BODY</h3>
            <pre className="request-body">
              {run.requestBody || 'Request body is not available.'}
            </pre>
          </section>
        </div>
      </details>
      <section className="rest-response-section">
        <h2>REST RESPONSE</h2>
        {run.responseBody !== undefined ? (
          <>
            <details className="rest-fold nested">
              <summary>
                <span className="rest-fold-symbol" aria-hidden="true" />
                <b>HEADERS</b>
              </summary>
              <div className="rest-fold-body">
                <HeaderFields headers={run.responseHeaders} />
              </div>
            </details>
            <section className="rest-section response-body-section">
              <h3>BODY</h3>
              <RemoteResponseView body={run.responseBody} status={run.httpStatus} />
            </section>
          </>
        ) : (
          <div className="response-pending">Waiting for the Remote Pod response…</div>
        )}
      </section>
    </div>
  );
}

function App() {
  const [activePanel, setActivePanel] = useState<ActivePanel>('runner');
  const [historyPanelOpen, setHistoryPanelOpen] = useState(true);
  const [historyRecords, setHistoryRecords] = useState<RunHistoryEntry[]>([]);
  const runMetadataRef = useRef<Map<string, RunMetadata>>(new Map());
  const persistedRunIds = useRef<Set<string>>(new Set());
  const [boot, setBoot] = useState<Bootstrap | null>(null);
  const [group, setGroup] = useState('trading');
  const [sidePanelWidth, setSidePanelWidth] = useState(390);
  const [runnerPanelOpen, setRunnerPanelOpen] = useState(true);
  const [selectedTests, setSelectedTests] = useState<TestEntry[]>([]);
  const [includedTestKeys, setIncludedTestKeys] = useState<Set<string>>(() => new Set());
  const [config, setConfig] = useState<ConfigEntry | null>(null);
  const [suiteIncluded, setSuiteIncluded] = useState(false);
  const [tab, setTab] = useState<RunKind>('local');
  const [localSettingsOpen, setLocalSettingsOpen] = useState(false);
  const [remoteSettingsOpen, setRemoteSettingsOpen] = useState(false);
  const [testConfigOpen, setTestConfigOpen] = useState(true);
  const [compatibleConfigsOpen, setCompatibleConfigsOpen] = useState(true);
  const [selectedTestsOpen, setSelectedTestsOpen] = useState(true);
  const [testLogOpen, setTestLogOpen] = useState(false);
  const [controlsOpen, setControlsOpen] = useState(true);
  const [theme, setTheme] = useState<AppTheme>(() => {
    const saved = window.localStorage.getItem('test-console-theme');
    if (saved === 'light' || saved === 'dark') return saved;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });
  const emptyTrace = 'Select a config and one or more tests, then run when ready.';
  const [runs, setRuns] = useState<Record<RunKind, Run | null>>({ local: null, remote: null });
  const [outputs, setOutputs] = useState<Record<RunKind, string>>({
    local: emptyTrace,
    remote: emptyTrace,
  });
  const traceOutputRef = useRef<HTMLPreElement | null>(null);
  const [runArchives, setRunArchives] = useState<Record<RunKind, RunPage[]>>({
    local: [],
    remote: [],
  });
  const [tracePageIndexes, setTracePageIndexes] = useState<Record<RunKind, number>>({
    local: 0,
    remote: 0,
  });
  const run = runs[tab];
  const output = outputs[tab];
  const otherRunKind: RunKind = tab === 'local' ? 'remote' : 'local';
  const otherRun = runs[otherRunKind];
  const setRun = (value: React.SetStateAction<Run | null>) =>
    setRuns((current) => {
      const previous = current[tab];
      const next =
        typeof value === 'function' ? (value as (run: Run | null) => Run | null)(previous) : value;
      return { ...current, [tab]: next };
    });
  const setOutput = (value: React.SetStateAction<string>) =>
    setOutputs((current) => {
      const previous = current[tab];
      const next =
        typeof value === 'function' ? (value as (output: string) => string)(previous) : value;
      return { ...current, [tab]: next };
    });
  const catalogVersion = useRef<number | null>(null);
  const localBranches = useRef<IndexedBranches | null>(null);
  const [indexing, setIndexing] = useState(false);
  const catalogUpdateCount = useRef(0);
  const [catalogUpdating, setCatalogUpdating] = useState(false);
  const [catalogProgress, setCatalogProgress] = useState<CatalogIndexProgress>({
    phase: 'idle',
    processedFiles: 0,
    totalFiles: 0,
    percentage: 0,
  });
  const startupStartedAt = useRef(performance.now());
  const [startupElapsedMs, setStartupElapsedMs] = useState(0);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [historyNotice, setHistoryNotice] = useState('');
  const [settings, setSettings] = useState<Settings>({
    browser: 'chrome',
    userSuffix: '',
    pathBranch: '',
    testsBranch: '',
    jobName: '',
    logDir: '',
    logoutAzure: false,
    allure: false,
  });
  const [jobNameAuto, setJobNameAuto] = useState(true);

  const applyLocalBranches = (branches: IndexedBranches) => {
    const previousBranches = localBranches.current;
    localBranches.current = branches;
    if (
      !previousBranches ||
      (previousBranches.path === branches.path && previousBranches.tests === branches.tests)
    )
      return false;
    setSettings((current) => followLocalBranchCheckout(current, previousBranches, branches));
    setBoot((current) => (current ? { ...current, branches } : current));
    return true;
  };

  const refreshHistory = async () => {
    const records = await pruneRunHistory<Run>(boot?.defaults.historyConfig.retentionDays ?? 7);
    setHistoryRecords(records.map(correctedHistoryRecord));
  };
  const displayRecords = useMemo(() => {
    const activeRunIds = new Set(
      (['local', 'remote'] as RunKind[])
        .filter((kind) => runs[kind]?.status === 'running')
        .map((kind) => kind + ':' + runs[kind]!.id),
    );
    return historyRecords.map((record) =>
      record.run.status === 'running' && !activeRunIds.has(record.id)
        ? { ...record, run: { ...record.run, status: 'incomplete' } }
        : record,
    );
  }, [historyRecords, runs]);

  const loadHistoryEntry = (record: RunHistoryEntry) => {
    const catalogFeatures = Object.entries(boot?.catalog.features || {});
    const match = catalogFeatures
      .flatMap(([featureGroup, catalog]) =>
        catalog.configs.map((item) => ({ featureGroup, catalog, item })),
      )
      .find(
        (candidate) =>
          normalizeFilePath(candidate.item.file) === normalizeFilePath(record.suiteFile),
      );
    const restoredConfig: ConfigEntry = match?.item || {
      name: record.suiteName,
      suiteClass: '',
      file: record.suiteFile,
      relativeFile: shortPath(record.suiteFile),
      featureGroup: match?.featureGroup || group,
    };
    const restoredTests = match
      ? match.catalog.tests.filter(
          (test) =>
            record.testNames.includes(test.name) && test.configIds.includes(match.item.file),
        )
      : [];
    const missingTests = record.testNames.filter(
      (name) => !restoredTests.some((test) => test.name === name),
    );
    const unresolved = [
      !match ? 'the saved Test Suite file' : '',
      missingTests.length
        ? `${missingTests.length} saved Test Case${missingTests.length === 1 ? '' : 's'}`
        : '',
    ]
      .filter(Boolean)
      .join(' and ');
    const versionDebug =
      record.testCodeCommit && record.appCommit
        ? ` Test Code commit: ${shortCommit(record.testCodeCommit)} (current ${shortCommit(boot?.commits.tests)}). App commit: ${shortCommit(record.appCommit)} (current ${shortCommit(boot?.commits.app)}).`
        : ' Commit information is unavailable for this older History entry.';
    setHistoryNotice(
      unresolved
        ? `History loaded with ${unresolved} unavailable in the current Test Index. Saved output remains available for review.${versionDebug}`
        : '',
    );
    if (match) setGroup(match.featureGroup);
    setConfig(restoredConfig);
    setSuiteIncluded(true);
    setSelectedTests(restoredTests);
    setIncludedTestKeys(new Set(restoredTests.map(testKey)));
    setTab(record.kind);
    const suiteHistory = matchingSuiteHistory(displayRecords, record);
    const suitePages = suiteHistory.map((item) => ({ run: item.run, output: item.output }));
    const historyTarget = historySelectionTarget(runs[record.kind], record.run.id);
    if (historyTarget === 'replace') {
      const [newestPage, ...olderPages] = suitePages;
      const selectedPage = Math.max(
        0,
        suiteHistory.findIndex((item) => item.id === record.id),
      );
      setRuns((current) => ({ ...current, [record.kind]: newestPage.run }));
      setOutputs((current) => ({ ...current, [record.kind]: newestPage.output }));
      setRunArchives((current) => ({ ...current, [record.kind]: olderPages }));
      setTracePageIndexes((current) => ({ ...current, [record.kind]: selectedPage }));
    } else if (historyTarget === 'live') {
      const liveRunId = runs[record.kind]!.id;
      setRunArchives((current) => ({
        ...current,
        [record.kind]: suitePages.filter((page) => page.run.id !== liveRunId),
      }));
      setTracePageIndexes((current) => ({ ...current, [record.kind]: 0 }));
    } else {
      const liveRunId = runs[record.kind]!.id;
      const archivedHistory = suiteHistory.filter((item) => item.run.id !== liveRunId);
      const selectedPage = archivedHistory.findIndex((item) => item.id === record.id);
      setRunArchives((current) => ({
        ...current,
        [record.kind]: archivedHistory.map((item) => ({ run: item.run, output: item.output })),
      }));
      setTracePageIndexes((current) => ({
        ...current,
        [record.kind]: selectedPage >= 0 ? selectedPage + 1 : 0,
      }));
    }
    setActivePanel('history');
    setHistoryPanelOpen(true);
  };

  useEffect(() => {
    void refreshHistory().catch(() => {
      /* History storage is optional; running tests must remain available. */
    });
  }, [boot?.defaults.historyConfig.retentionDays]);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem('test-console-theme', theme);
  }, [theme]);
  useEffect(() => {
    document.title = testSuiteDocumentTitle(config?.name, config?.relativeFile);
  }, [config]);
  useEffect(() => {
    if (!jobNameAuto) return;
    setSettings((current) => {
      const jobName = defaultJobName(current.testsBranch, current.userSuffix);
      return current.jobName === jobName ? current : { ...current, jobName };
    });
  }, [settings.testsBranch, settings.userSuffix, jobNameAuto]);
  useEffect(() => {
    api<Bootstrap>('/api/bootstrap')
      .then((data) => {
        const userSuffix =
          data.user.username
            .toLowerCase()
            .replace(/[^a-z0-9-]+/g, '-')
            .replace(/^-+|-+$/g, '') || data.defaults.podRunConfig.userSuffix;
        const branches = localBranches.current ?? data.branches;
        localBranches.current = branches;
        setBoot({ ...data, branches });
        setLastSyncedAt(new Date().toISOString());
        setGroup(data.defaults.testSource.featureGroup);
        setSettings({
          browser: data.defaults.localRunConfig.browser,
          userSuffix,
          pathBranch: branches.path,
          testsBranch: branches.tests,
          jobName: defaultJobName(branches.tests, userSuffix),
          logDir: data.defaults.localRunConfig.logDir,
          logoutAzure: false,
          allure: data.defaults.localRunConfig.allure ?? false,
        });
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  }, []);
  useEffect(() => {
    if (boot || error) return;
    let active = true;
    const checkProgress = async () => {
      try {
        const progress = await api<CatalogIndexProgress>('/api/catalog/progress');
        if (active) setCatalogProgress(progress);
      } catch {
        /* Bootstrap reports actionable errors; progress polling is best effort. */
      }
    };
    void checkProgress();
    const timer = window.setInterval(checkProgress, 150);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [boot, error]);
  useEffect(() => {
    if (boot || error) return;
    const updateElapsed = () => setStartupElapsedMs(performance.now() - startupStartedAt.current);
    updateElapsed();
    const timer = window.setInterval(updateElapsed, 100);
    return () => window.clearInterval(timer);
  }, [boot, error]);
  useEffect(() => {
    let active = true;
    const applyCatalog = async (version: number) => {
      if (catalogVersion.current === null) {
        catalogVersion.current = version;
        return false;
      }
      if (version <= catalogVersion.current) return false;
      catalogUpdateCount.current += 1;
      setCatalogUpdating(true);
      try {
        const catalog = await api<Catalog>('/api/catalog/refresh', { method: 'POST' });
        if (!active || (catalogVersion.current !== null && version <= catalogVersion.current))
          return false;
        catalogVersion.current = version;
        setBoot((current) => (current ? { ...current, catalog } : current));
        return true;
      } finally {
        catalogUpdateCount.current -= 1;
        if (active && catalogUpdateCount.current === 0) setCatalogUpdating(false);
      }
    };
    const applyStatus = async ({ version, branches }: SyncStatus) => {
      const branchesChanged = applyLocalBranches(branches);
      const catalogChanged = await applyCatalog(version);
      if (active && (branchesChanged || catalogChanged))
        setLastSyncedAt(new Date().toISOString());
    };
    const source = new EventSource('/api/sync/events');
    source.onmessage = (message) => {
      const event = JSON.parse(message.data) as SyncEvent;
      if (event.type === 'status') void applyStatus(event);
      else if (event.type === 'branches') {
        if (applyLocalBranches(event.branches) && active)
          setLastSyncedAt(new Date().toISOString());
      } else
        void applyCatalog(event.version).then((changed) => {
          if (active && changed) setLastSyncedAt(new Date().toISOString());
        });
    };
    return () => {
      active = false;
      source.close();
    };
  }, []);
  useEffect(() => {
    if (!run?.id || ['passed', 'failed', 'cancelled'].includes(run.status)) return;
    setOutput('');
    const source = new EventSource(`/api/runs/${run.id}/events`);
    source.onmessage = (event) => {
      const next = JSON.parse(event.data) as {
        output: string;
        status: string;
        exitCode: number | null;
        azureReady?: boolean;
        requestUrl?: string;
        requestHeaders?: Record<string, string>;
        requestBody?: string;
        responseHeaders?: Record<string, string>;
        responseBody?: unknown;
        httpStatus?: number;
      };
      if (next.output) setOutput((old) => old + next.output);
      setRun((old) =>
        old
          ? {
              ...old,
              status: next.status,
              exitCode: next.exitCode,
              ...(next.requestUrl !== undefined ? { requestUrl: next.requestUrl } : {}),
              ...(next.requestHeaders !== undefined ? { requestHeaders: next.requestHeaders } : {}),
              ...(next.requestBody !== undefined ? { requestBody: next.requestBody } : {}),
              ...(next.responseHeaders !== undefined
                ? { responseHeaders: next.responseHeaders }
                : {}),
              ...(next.responseBody !== undefined ? { responseBody: next.responseBody } : {}),
              ...(next.httpStatus !== undefined ? { httpStatus: next.httpStatus } : {}),
            }
          : old,
      );
      if (['passed', 'failed', 'cancelled'].includes(next.status)) source.close();
    };
    return () => source.close();
  }, [run?.id, tab]);

  useEffect(() => {
    const timers = (['local', 'remote'] as RunKind[]).map((kind) => {
      const activeRun = runs[kind];
      const metadata = activeRun && runMetadataRef.current.get(activeRun.id);
      if (!activeRun || !metadata || ['passed', 'failed', 'cancelled'].includes(activeRun.status))
        return undefined;
      return window.setTimeout(() => {
        const record: RunHistoryEntry = {
          id: kind + ':' + activeRun.id,
          kind,
          startedAt: activeRun.startedAt || new Date().toISOString(),
          endedAt: '',
          suiteName: metadata.suiteName,
          suiteFile: metadata.suiteFile,
          testNames: metadata.testNames,
          testCodeCommit: boot?.commits.tests,
          appCommit: boot?.commits.app,
          run: { ...activeRun, status: 'running' },
          output: outputs[kind],
        };
        void saveRunHistory(record).then(refreshHistory);
      }, 750);
    });
    return () => timers.forEach((timer) => timer !== undefined && window.clearTimeout(timer));
  }, [runs, outputs, boot?.commits.tests, boot?.commits.app]);
  useEffect(() => {
    (['local', 'remote'] as RunKind[]).forEach((kind) => {
      const completedRun = runs[kind];
      if (!completedRun || !['passed', 'failed', 'cancelled'].includes(completedRun.status)) return;
      const storageId = kind + ':' + completedRun.id;
      if (persistedRunIds.current.has(storageId)) return;
      const metadata = runMetadataRef.current.get(completedRun.id);
      if (!metadata) return;
      persistedRunIds.current.add(storageId);
      const historyRun =
        completedRun.status === 'cancelled'
          ? { ...completedRun, status: 'incomplete' }
          : completedRun;
      const record: RunHistoryEntry = {
        id: storageId,
        kind,
        startedAt: completedRun.startedAt || new Date().toISOString(),
        endedAt: completedRun.endedAt || new Date().toISOString(),
        suiteName: metadata.suiteName,
        suiteFile: metadata.suiteFile,
        testNames: metadata.testNames,
        testCodeCommit: boot?.commits.tests,
        appCommit: boot?.commits.app,
        run: historyRun,
        output: outputs[kind],
      };
      void saveRunHistory(record)
        .then(refreshHistory)
        .catch(() => persistedRunIds.current.delete(storageId));
    });
  }, [runs, outputs]);
  const feature = boot?.catalog.features[group] || { tests: [], configs: [] };
  const tracePageIndex = Math.min(tracePageIndexes[tab], runArchives[tab].length);
  const archivedTracePage = tracePageIndex > 0 ? runArchives[tab][tracePageIndex - 1] : null;
  const displayedRun = archivedTracePage?.run ?? run;
  const displayedOutput = archivedTracePage?.output ?? output;
  const remoteBranchDifferences = boot ? differingBranches(settings, boot.branches) : [];
  const hasDisplayedRunPage = Boolean(
    displayedRun &&
    (displayedOutput ||
      displayedRun.requestUrl ||
      displayedRun.requestBody !== undefined ||
      displayedRun.responseBody !== undefined),
  );
  const tracePageCount = runArchives[tab].length + 1;
  const setTracePage = (index: number) =>
    setTracePageIndexes((current) => ({
      ...current,
      [tab]: Math.max(0, Math.min(index, runArchives[tab].length)),
    }));

  useEffect(() => {
    if (
      activePanel !== 'history' ||
      tab !== 'remote' ||
      !displayedRun?.pathBranch ||
      !displayedRun.testsBranch
    )
      return;
    setJobNameAuto(false);
    setSettings((current) =>
      restoreRemoteSettings(current, {
        pathBranch: displayedRun.pathBranch!,
        testsBranch: displayedRun.testsBranch!,
        jobName: displayedRun.jobName,
        userSuffix: displayedRun.userSuffix,
      }),
    );
  }, [
    activePanel,
    tab,
    displayedRun?.id,
    displayedRun?.pathBranch,
    displayedRun?.testsBranch,
    displayedRun?.jobName,
    displayedRun?.userSuffix,
  ]);

  const clearTracePage = () => {
    if (tracePageIndex === 0) {
      setOutput('');
      if (tab === 'remote')
        setRun((current) =>
          current
            ? {
                ...current,
                requestUrl: undefined,
                requestHeaders: undefined,
                requestBody: undefined,
                responseHeaders: undefined,
                responseBody: undefined,
                httpStatus: undefined,
              }
            : current,
        );
      return;
    }
    setRunArchives((current) => ({
      ...current,
      [tab]: current[tab].map((page, index) =>
        index === tracePageIndex - 1
          ? {
              ...page,
              output: '',
              run:
                page.run.kind === 'remote'
                  ? {
                      ...page.run,
                      requestUrl: undefined,
                      requestHeaders: undefined,
                      requestBody: undefined,
                      responseHeaders: undefined,
                      responseBody: undefined,
                      httpStatus: undefined,
                    }
                  : page.run,
            }
          : page,
      ),
    }));
  };

  const clearAllTracePages = () => {
    setRunArchives((current) => ({ ...current, [tab]: [] }));
    setTracePageIndexes((current) => ({ ...current, [tab]: 0 }));
    setOutput('');
    if (tab === 'remote')
      setRun((current) =>
        current
          ? {
              ...current,
              requestUrl: undefined,
              requestHeaders: undefined,
              requestBody: undefined,
              responseHeaders: undefined,
              responseBody: undefined,
              httpStatus: undefined,
            }
          : current,
      );
  };

  useEffect(() => {
    if (tab !== 'local' || tracePageIndex !== 0) return;
    const frame = window.requestAnimationFrame(() =>
      traceOutputRef.current?.scrollTo({ top: traceOutputRef.current.scrollHeight }),
    );
    return () => window.cancelAnimationFrame(frame);
  }, [displayedOutput, tab, tracePageIndex]);

  const indexedTestsRoot = useMemo(() => {
    if (!boot) return '';
    const entries = Object.values(boot.catalog.features).flatMap((item) => [
      ...item.tests,
      ...item.configs,
    ]);
    const entry = entries.find((item) => item.file && item.relativeFile);
    if (!entry?.relativeFile) return '';
    const file = normalizeFilePath(entry.file);
    const relative = normalizeFilePath(entry.relativeFile);
    return file.endsWith(relative) ? file.slice(0, -relative.length).replace(/\\$/, '') : '';
  }, [boot]);
  const runnableTests = selectedTests.filter((test) => includedTestKeys.has(testKey(test)));
  const unavailableTests = selectedTests.filter(
    (test) => !feature.tests.some((current) => testKey(current) === testKey(test)),
  );
  const unavailableTestKeys = new Set(unavailableTests.map(testKey));
  const unavailableRunnableTests = runnableTests.filter((test) =>
    unavailableTestKeys.has(testKey(test)),
  );
  const configUnavailable = Boolean(
    config && !feature.configs.some((current) => current.file === config.file),
  );
  const suggestedConfigs = runnableTests.length
    ? feature.configs.filter((x) => runnableTests.every((test) => test.configIds.includes(x.file)))
    : feature.configs;
  const relatedConfigs = config
    ? feature.configs.filter((item) => {
        const selectedDirectory = normalizeFilePath(config.file).slice(
          0,
          normalizeFilePath(config.file).lastIndexOf('\\'),
        );
        const itemDirectory = normalizeFilePath(item.file).slice(
          0,
          normalizeFilePath(item.file).lastIndexOf('\\'),
        );
        return item.suiteClass === config.suiteClass || itemDirectory === selectedDirectory;
      })
    : [];
  const setupConfigs = runnableTests.length ? suggestedConfigs : relatedConfigs;
  const compatibleSetupTests = config
    ? filterTestEntries(feature.tests, [config], config.name)
    : selectedTests;
  const toggleTest = (test: TestEntry) =>
    setSelectedTests((old) => {
      const removing = old.some((x) => x.name === test.name && x.file === test.file);
      const next = removing ? old.filter((x) => testKey(x) !== testKey(test)) : [...old, test];
      const nextKeys = new Set(includedTestKeys);
      if (removing) nextKeys.delete(testKey(test));
      else nextKeys.add(testKey(test));
      setIncludedTestKeys(nextKeys);
      const nextRunnable = next.filter((item) => nextKeys.has(testKey(item)));
      if (
        nextRunnable.length &&
        config &&
        !nextRunnable.every((item) => item.configIds.includes(config.file))
      ) {
        setConfig(null);
        setSuiteIncluded(false);
        setCompatibleConfigsOpen(true);
      }
      return next;
    });
  const toggleRunnableTest = (test: TestEntry) =>
    setIncludedTestKeys((current) => {
      const next = new Set(current);
      if (next.has(testKey(test))) next.delete(testKey(test));
      else next.add(testKey(test));
      const nextRunnable = selectedTests.filter((item) => next.has(testKey(item)));
      if (
        nextRunnable.length &&
        config &&
        !nextRunnable.every((item) => item.configIds.includes(config.file))
      ) {
        setConfig(null);
        setSuiteIncluded(false);
        setCompatibleConfigsOpen(true);
      }
      return next;
    });

  const pickConfig = (item: ConfigEntry, collapseTestSuite = true) => {
    setConfig(item);
    setSuiteIncluded(true);
    setCompatibleConfigsOpen(!collapseTestSuite);
    setSelectedTestsOpen(true);
    setSelectedTests((old) => old.filter((test) => test.configIds.includes(item.file)));
  };

  const selectFeatureGroup = (nextGroup: string) => {
    setGroup(nextGroup);
    setSelectedTests([]);
    setIncludedTestKeys(new Set());
    setConfig(null);
    setSuiteIncluded(false);
    setCompatibleConfigsOpen(true);
  };

  const runNow = async () => {
    try {
      setError('');
      const body = { ...settings, featureGroup: group, config, tests: runnableTests };
      const previousRun = run;
      const previousOutput = output;
      const next = await api<Run>(`/api/run/${tab}`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      if (previousRun)
        setRunArchives((current) => ({
          ...current,
          [tab]: [
            { run: previousRun, output: previousOutput },
            ...current[tab].filter((page) => page.run.id !== previousRun.id),
          ].slice(0, 24),
        }));
      const metadata = {
        suiteName: config!.name,
        suiteFile: config!.file,
        testNames: runnableTests.map((test) => test.name),
      };
      runMetadataRef.current.set(next.id, metadata);
      const storageId = tab + ':' + next.id;
      const incompleteRecord: RunHistoryEntry = {
        id: storageId,
        kind: tab,
        startedAt: next.startedAt || new Date().toISOString(),
        endedAt: '',
        suiteName: metadata.suiteName,
        suiteFile: metadata.suiteFile,
        testNames: metadata.testNames,
        testCodeCommit: boot?.commits.tests,
        appCommit: boot?.commits.app,
        run: { ...next, status: 'running' },
        output: '',
      };
      await saveRunHistory(incompleteRecord);
      await refreshHistory();
      setTracePageIndexes((current) => ({ ...current, [tab]: 0 }));
      setRun(next);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const stopRun = async () => {
    if (!run?.id || run.status !== 'running') return;
    try {
      const stopped = await api<Run>(`/api/runs/${run.id}/cancel`, { method: 'POST' });
      setRun(stopped);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const refresh = async () => {
    if (indexing) return;
    setIndexing(true);
    setError('');
    try {
      const [catalog, status] = await Promise.all([
        api<Catalog>('/api/catalog/refresh', { method: 'POST' }),
        api<SyncStatus>('/api/sync/status'),
      ]);
      applyLocalBranches(status.branches);
      catalogVersion.current = status.version;
      setBoot((old) => (old ? { ...old, catalog } : old));
      setLastSyncedAt(new Date().toISOString());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIndexing(false);
    }
  };

  if (!boot)
    return (
      <main className="loading">
        <div className="spinner" />
        <p>Indexing PATH test suites…</p>
        <strong
          className="loading-percentage"
          role="progressbar"
          aria-label="Test suite indexing progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={catalogProgress.percentage}
        >
          {catalogProgress.percentage}%
        </strong>
        <time className="loading-elapsed" aria-label="Elapsed startup time">
          Elapsed {formatStartupElapsed(startupElapsedMs)}
        </time>
        {error && <p className="error">{error}</p>}
      </main>
    );
  const sidePanelOpen = activePanel === 'runner' ? runnerPanelOpen : historyPanelOpen;
  const togglePanel = (panel: ActivePanel) => {
    if (panel === activePanel) {
      if (panel === 'runner') setRunnerPanelOpen((open) => !open);
      else setHistoryPanelOpen((open) => !open);
      return;
    }
    setActivePanel(panel);
    if (panel === 'runner') {
      setSettings((current) => resetRemoteBranchesToLocal(current, boot.branches));
      setRunnerPanelOpen(true);
    } else setHistoryPanelOpen(true);
  };
  return (
    <div
      className="app"
      style={{
        '--side-panel-width': `${sidePanelOpen ? sidePanelWidth : 44}px`,
      } as React.CSSProperties}
    >
      <AppHeader
        branches={boot.branches}
        indexing={indexing || catalogUpdating}
        lastSyncedAt={lastSyncedAt}
        theme={theme}
        user={boot.user}
        onRefresh={refresh}
        onThemeToggle={() => setTheme((current) => (current === 'light' ? 'dark' : 'light'))}
      />
      <NavigationRail
        activePanel={activePanel}
        panelOpen={sidePanelOpen}
        onSelect={togglePanel}
      />
      <SidePanel
        open={sidePanelOpen}
        width={sidePanelWidth}
        onWidthChange={setSidePanelWidth}
      >
        {activePanel === 'history' && (
          <HistoryPanel records={displayRecords} onLoad={loadHistoryEntry} />
        )}
        {activePanel === 'runner' && (
          <RunnerSearchPanel
            groups={boot.catalog.groups}
            group={group}
            feature={feature}
            indexedTestsRoot={indexedTestsRoot}
            selectedTests={selectedTests}
            selectedConfig={config}
            suiteIncluded={suiteIncluded}
            catalogUpdating={indexing || catalogUpdating}
            onGroupChange={selectFeatureGroup}
            onToggleTest={toggleTest}
            onSelectConfig={pickConfig}
            onSuiteIncludedChange={setSuiteIncluded}
          />
        )}
      </SidePanel>
      <main className="workspace">
        <div className="runner-view">
          <div className="crumb">
            Collections <span>/</span> {group} <span>/</span> Debug run
          </div>
          <section className="request-card">
            <div
              className="request-title config-master-fold"
              role="button"
              tabIndex={0}
              aria-expanded={testConfigOpen}
              title={testConfigOpen ? 'Collapse whole Test Config' : 'Expand whole Test Config'}
              onClick={() => setTestConfigOpen((open) => !open)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  setTestConfigOpen((open) => !open);
                }
              }}
            >
              <div className="config-title-copy">
                <h1>
                  <span className="fold-symbol">{testConfigOpen ? '−' : '+'}</span>
                  <span>Test Config</span>
                  <span className={`method ${tab}`}>{tab === 'local' ? 'LOCAL' : 'POST'}</span>
                </h1>
                <p title={config?.name}>
                  {config ? config.name : 'Choose tests and a compatible config'}
                </p>
              </div>
              <span className="selection-count">
                {selectedTests.length} test{selectedTests.length !== 1 && 's'} selected
              </span>
            </div>
            {testConfigOpen && (
              <>
                <div className="tabs">
                  <button
                    className={tab === 'local' ? 'active' : ''}
                    onClick={() => setTab('local')}
                  >
                    Local PowerShell
                  </button>
                  <button
                    className={tab === 'remote' ? 'active' : ''}
                    onClick={() => setTab('remote')}
                  >
                    Remote Pod
                  </button>
                </div>
                <div className="run-tree" aria-label="Resolved test run configuration">
                  <div className="tree-node root">
                    <span
                      className={`tree-status ${tab === 'local' && !settings.logoutAzure ? 'ready' : ''}`}
                    />
                    <b>AZ Login</b>
                    <em>
                      {tab === 'remote'
                        ? 'Managed by remote pod'
                        : settings.logoutAzure
                          ? 'Logout, then login'
                          : 'Smart session check'}
                    </em>
                  </div>
                  <div className="tree-node root">
                    <span className="tree-status ready" />
                    <b>PathCLI</b>
                    <em>
                      {tab === 'local'
                        ? settings.browser === 'config'
                          ? 'Use config (remote browser)'
                          : `${settings.browser} (local override)`
                        : 'Remote Pod'}
                    </em>
                  </div>
                  <div className="tree-children">
                    <div className={`tree-node ${configUnavailable ? 'unavailable' : ''}`}>
                      <b>TEST SUITE</b>
                      <em title={config?.name}>
                        {config?.name || 'Not selected'}
                        {config && !suiteIncluded && (
                          <strong className="unchecked-note">UNCHECKED</strong>
                        )}
                        {configUnavailable && (
                          <strong className="unavailable-note">NOT AVAILABLE ANYMORE</strong>
                        )}
                      </em>
                    </div>
                    <div
                      className={`tree-node ${unavailableRunnableTests.length ? 'unavailable' : ''}`}
                    >
                      <b>TEST CASE</b>
                      <em title={runnableTests.map((test) => test.name).join(', ')}>
                        {runnableTests.length
                          ? runnableTests.map((test) => test.name).join(', ')
                          : config && suiteIncluded
                            ? 'Entire test suite'
                            : 'None selected'}
                        {unavailableRunnableTests.length > 0 && (
                          <strong className="unavailable-note">
                            {unavailableRunnableTests.map((test) => test.name).join(', ')} — NOT
                            AVAILABLE ANYMORE
                          </strong>
                        )}
                      </em>
                    </div>
                    {tab === 'local' && (
                      <div className="tree-node">
                        <b>TEST LOG</b>
                        <em title={settings.logDir}>{settings.logDir}</em>
                      </div>
                    )}
                    <div className="tree-node">
                      <b>ALLURE REPORT</b>
                      <em>{settings.allure ? 'Enabled' : 'Disabled'}</em>
                    </div>
                  </div>
                </div>
                <div className="controls-panel">
                  <button
                    className="controls-fold"
                    type="button"
                    aria-expanded={controlsOpen}
                    onClick={() => setControlsOpen((open) => !open)}
                  >
                    <em className="fold-symbol">{controlsOpen ? '−' : '+'}</em>
                    <b>Setup</b>
                  </button>
                  {controlsOpen && (
                    <div className="form control-stack">
                      {tab === 'local' && (
                        <div className="azure-setting full">
                          <div
                            className="azure-options"
                            role="radiogroup"
                            aria-label="Azure login behavior"
                          >
                            <label className="azure-choice">
                              <input
                                type="radio"
                                name="azure-mode"
                                checked={!settings.logoutAzure}
                                onChange={() => setSettings((x) => ({ ...x, logoutAzure: false }))}
                              />
                              <b>AZ Smart Session Check</b>
                            </label>
                            <label className="azure-choice">
                              <input
                                type="radio"
                                name="azure-mode"
                                checked={settings.logoutAzure}
                                onChange={() => setSettings((x) => ({ ...x, logoutAzure: true }))}
                              />
                              <b>AZ Logout then Login</b>
                            </label>
                          </div>
                          <small>
                            {settings.logoutAzure
                              ? 'Flush the current Azure CLI session, sign in again, then verify the Key Vault token.'
                              : 'Reuse a valid Key Vault session or prompt with az login when needed.'}
                          </small>
                        </div>
                      )}

                      <div
                        className={`local-settings full ${tab === 'remote' ? 'remote-settings' : ''}`}
                      >
                        <button
                          className="settings-fold"
                          type="button"
                          aria-expanded={tab === 'local' ? localSettingsOpen : remoteSettingsOpen}
                          onClick={() =>
                            tab === 'local'
                              ? setLocalSettingsOpen((open) => !open)
                              : setRemoteSettingsOpen((open) => !open)
                          }
                        >
                          <em className="fold-symbol">
                            {(tab === 'local' ? localSettingsOpen : remoteSettingsOpen) ? '−' : '+'}
                          </em>
                          <span>
                            <b>{tab === 'local' ? 'BROWSER' : 'REMOTE CONFIG'}</b>
                            {tab === 'local' ? (
                              <small>
                                {settings.browser === 'config'
                                  ? 'Use config (remote browser)'
                                  : `${settings.browser} (local override)`}
                              </small>
                            ) : (
                              <small className="remote-config-summary">
                                <span>
                                  <strong>PATH BRANCH:</strong> {settings.pathBranch}
                                </span>
                                <span>
                                  <strong>TEST BRANCH:</strong> {settings.testsBranch}
                                </span>
                                <span>
                                  <strong>JOB NAME:</strong> {settings.jobName}
                                </span>
                              </small>
                            )}
                          </span>
                        </button>
                        {(tab === 'local' ? localSettingsOpen : remoteSettingsOpen) && (
                          <div className="local-settings-body">
                            {tab === 'local' ? (
                              <div className="field full">
                                <label>BROWSER MODE</label>
                                <select
                                  value={settings.browser}
                                  onChange={(e) =>
                                    setSettings((x) => ({ ...x, browser: e.target.value }))
                                  }
                                >
                                  <option value="config">Use config (remote browser)</option>
                                  <option value="chrome">chrome (local override)</option>
                                  <option value="edge">edge (local override)</option>
                                  <option value="firefox">firefox (local override)</option>
                                </select>
                              </div>
                            ) : (
                              <>
                                <RemoteBranchFields
                                  pathBranch={settings.pathBranch}
                                  testsBranch={settings.testsBranch}
                                  localPathBranch={boot.branches.path}
                                  localTestsBranch={boot.branches.tests}
                                  pathDifferent={remoteBranchDifferences.includes('path')}
                                  testsDifferent={remoteBranchDifferences.includes('tests')}
                                  onPathBranchChange={(pathBranch) =>
                                    setSettings((current) => ({ ...current, pathBranch }))
                                  }
                                  onTestsBranchChange={(testsBranch) =>
                                    setSettings((current) => ({ ...current, testsBranch }))
                                  }
                                  onUseCurrentLocal={() =>
                                    setSettings((current) =>
                                      resetRemoteBranchesToLocal(current, boot.branches),
                                    )
                                  }
                                  onUseDevelop={() =>
                                    setSettings((current) => ({
                                      ...current,
                                      pathBranch: 'develop',
                                      testsBranch: 'develop',
                                    }))
                                  }
                                />
                                <div className="field">
                                  <label>USER SUFFIX</label>
                                  <input
                                    value={settings.userSuffix}
                                    onChange={(e) =>
                                      setSettings((x) => ({ ...x, userSuffix: e.target.value }))
                                    }
                                  />
                                </div>
                                <div className="field">
                                  <label>JOB NAME</label>
                                  <input
                                    value={settings.jobName}
                                    onChange={(e) => {
                                      setJobNameAuto(false);
                                      setSettings((x) => ({ ...x, jobName: e.target.value }));
                                    }}
                                  />
                                </div>
                              </>
                            )}
                          </div>
                        )}
                        {tab === 'remote' && remoteBranchDifferences.length > 0 && (
                          <div className="branch-mismatch-note" role="status">
                            <span aria-hidden="true">⚠</span>
                            <div>
                              <strong>
                                POD branches differ from local repo branches.
                              </strong>
                              <small>
                                {remoteBranchDifferences.includes('path') && (
                                  <span>
                                    PATH: {settings.pathBranch} (POD) · {boot.branches.path} (local)
                                  </span>
                                )}
                                {remoteBranchDifferences.includes('tests') && (
                                  <span>
                                    TEST: {settings.testsBranch} (POD) · {boot.branches.tests} (local)
                                  </span>
                                )}
                              </small>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="field full compatible-configs">
                        <button
                          className="config-list-fold"
                          type="button"
                          aria-expanded={compatibleConfigsOpen}
                          onClick={() => setCompatibleConfigsOpen((open) => !open)}
                        >
                          <em className="fold-symbol">{compatibleConfigsOpen ? '−' : '+'}</em>
                          <span>
                            <b>TEST SUITE</b>
                            <small title={config?.name}>
                              {config?.name || 'Select a compatible config'}
                            </small>
                            {config && !suiteIncluded && (
                              <strong className="unchecked-note">UNCHECKED</strong>
                            )}
                            {configUnavailable && (
                              <strong className="unavailable-note">NOT AVAILABLE ANYMORE</strong>
                            )}
                          </span>
                        </button>
                        {compatibleConfigsOpen &&
                          (setupConfigs.length ? (
                            <div className="config-choices">
                              {setupConfigs.map((item) => {
                                const selected = config?.file === item.file;
                                const checked = selected && suiteIncluded;
                                return (
                                  <div
                                    className={`config-choice-row ${selected ? 'active' : ''}`}
                                    key={item.file}
                                  >
                                    <label
                                      className="run-check"
                                      title={
                                        checked
                                          ? 'Exclude this suite from the next run'
                                          : 'Select and include this suite in the next run'
                                      }
                                    >
                                      <input
                                        type="checkbox"
                                        checked={checked}
                                        onChange={() => {
                                          if (selected) setSuiteIncluded((value) => !value);
                                          else pickConfig(item, false);
                                        }}
                                      />
                                      <span>✓</span>
                                    </label>
                                    <div className="config-choice-content" title={item.file}>
                                      <span>
                                        <b>{item.name}</b>
                                        <small>{shortPath(item.relativeFile)}</small>
                                      </span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="config-guidance">
                              {config
                                ? 'No related configs are available.'
                                : 'Check a test case or select a config to resolve related suites.'}
                            </div>
                          ))}
                      </div>

                      <div className="selected field full">
                        <div className="selected-head config-list-fold">
                          <button
                            className="selected-fold"
                            type="button"
                            aria-expanded={selectedTestsOpen}
                            onClick={() => setSelectedTestsOpen((open) => !open)}
                          >
                            <em className="fold-symbol">{selectedTestsOpen ? '−' : '+'}</em>
                            <span>
                              <b>TEST CASE</b>
                              <small>
                                {compatibleSetupTests.length
                                  ? `${compatibleSetupTests.length} compatible test case${compatibleSetupTests.length !== 1 ? 's' : ''} · ${runnableTests.length} checked`
                                  : 'Select a config or test cases'}
                              </small>
                              {unavailableTests.length > 0 && (
                                <strong className="unavailable-note">
                                  {unavailableTests.map((test) => test.name).join(', ')} — NOT
                                  AVAILABLE ANYMORE
                                </strong>
                              )}
                            </span>
                          </button>
                        </div>
                        {selectedTestsOpen && (
                          <div className="selected-body">
                            {compatibleSetupTests.length > 0 && (
                              <div className="case-actions">
                                <span>
                                  {runnableTests.length
                                    ? `${runnableTests.length} of ${compatibleSetupTests.length} checked`
                                    : '0 checked · entire suite will run'}
                                </span>
                                <button onClick={() => setIncludedTestKeys(new Set())}>
                                  Clear all
                                </button>
                              </div>
                            )}
                            {compatibleSetupTests.length ? (
                              compatibleSetupTests.map((test) => {
                                const selected = selectedTests.some(
                                  (item) => testKey(item) === testKey(test),
                                );
                                const checked = selected && includedTestKeys.has(testKey(test));
                                return (
                                  <div
                                    className={`chip ${unavailableTestKeys.has(testKey(test)) ? 'unavailable' : ''}`}
                                    key={test.name + test.file}
                                  >
                                    <label
                                      className="run-check"
                                      title={
                                        checked ? 'Exclude from next run' : 'Include in next run'
                                      }
                                    >
                                      <input
                                        type="checkbox"
                                        checked={checked}
                                        onChange={() =>
                                          selected ? toggleRunnableTest(test) : toggleTest(test)
                                        }
                                      />
                                      <span>✓</span>
                                    </label>
                                    <div>
                                      <b>{test.name}</b>
                                      <small>{shortPath(test.relativeFile)}</small>
                                      {unavailableTestKeys.has(testKey(test)) && (
                                        <strong className="unavailable-note">
                                          NOT AVAILABLE ANYMORE
                                        </strong>
                                      )}
                                    </div>
                                    {selected && (
                                      <button
                                        onClick={() => toggleTest(test)}
                                        title="Remove from selected tests"
                                      >
                                        ×
                                      </button>
                                    )}
                                  </div>
                                );
                              })
                            ) : (
                              <div className="empty small">
                                {config
                                  ? 'No compatible test cases are available for this config.'
                                  : 'Select a config or test cases from the Search Panel.'}
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {tab === 'local' && (
                        <div className="local-settings full test-log-settings">
                          <button
                            className="settings-fold"
                            type="button"
                            aria-expanded={testLogOpen}
                            onClick={() => setTestLogOpen((open) => !open)}
                          >
                            <em className="fold-symbol">{testLogOpen ? '−' : '+'}</em>
                            <span>
                              <b>TEST LOG</b>
                              <small>{settings.logDir}</small>
                            </span>
                          </button>
                          {testLogOpen && (
                            <div className="local-settings-body">
                              <div className="field full log-directory">
                                <label>LOG DIRECTORY (EDITABLE)</label>
                                <input
                                  className="path-input"
                                  aria-label="Editable test log directory"
                                  title={settings.logDir}
                                  spellCheck={false}
                                  value={settings.logDir}
                                  onChange={(e) =>
                                    setSettings((x) => ({ ...x, logDir: e.target.value }))
                                  }
                                />
                                <small>Uses --log-dir together with --log-env.</small>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {tab === 'local' && (
                        <div className="azure-setting full allure-setting">
                          <label className="toggle">
                            <input
                              type="checkbox"
                              checked={settings.allure}
                              onChange={(e) =>
                                setSettings((x) => ({ ...x, allure: e.target.checked }))
                              }
                            />
                            <span />
                            <b>Generate Allure Report</b>
                          </label>
                          <small>
                            {settings.allure
                              ? 'Enabled for the local run.'
                              : 'Disabled for the local run.'}
                          </small>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}
            <div className="run-control-panel">
              {otherRun?.status === 'running' && (
                <div className="parallel-run-note" role="status">
                  <span aria-hidden="true">●</span>
                  <strong>
                    {otherRunKind === 'local' ? 'Local PowerShell test' : 'Remote Pod request'} is
                    still running.
                  </strong>{' '}
                  Try not to intervene until it finishes.
                </div>
              )}
              <div className="runbar test-runbar">
                {run && (
                  <div className="run-status">
                    <i className={run.status} />
                    <span>Last run: {runStatusLabel(run, output)}</span>
                  </div>
                )}
                <div className="run-actions">
                  {tab === 'local' && (
                    <button
                      className="stop-run"
                      type="button"
                      disabled={run?.status !== 'running'}
                      onClick={stopRun}
                    >
                      <span aria-hidden="true">■</span> Stop the run
                    </button>
                  )}
                  <button
                    className="run"
                    disabled={
                      !config ||
                      !suiteIncluded ||
                      configUnavailable ||
                      unavailableRunnableTests.length > 0 ||
                      run?.status === 'running'
                    }
                    aria-label={
                      runnableTests.length
                        ? run
                          ? 'Rerun selected tests'
                          : 'Run selected tests'
                        : run
                          ? 'Rerun entire test suite'
                          : 'Run entire test suite'
                    }
                    onClick={runNow}
                  >
                    <span aria-hidden="true">▶</span> {run ? 'Rerun ' : 'Run '}
                    {tab === 'local' ? 'locally' : 'on remote pod'}
                  </button>
                </div>
              </div>
            </div>
            {historyNotice && <div className="alert notice">{historyNotice}</div>}
            {error && <div className="alert">{error}</div>}
          </section>
          <section className="console">
            <div className="console-head">
              <div>
                <i />
                <b>{tab === 'remote' ? 'REST request and response' : 'Execution trace'}</b>
              </div>
              {(hasDisplayedRunPage || runArchives[tab].length > 0) && (
                <nav
                  className="trace-pager"
                  aria-label={
                    tab === 'remote' ? 'Remote Pod Request pages' : 'PowerShell run pages'
                  }
                >
                  <button
                    disabled={tracePageIndex === 0}
                    onClick={() => setTracePage(tracePageIndex - 1)}
                  >
                    ← Newer
                  </button>
                  <button
                    disabled={tracePageIndex >= tracePageCount - 1}
                    onClick={() => setTracePage(tracePageIndex + 1)}
                  >
                    Older →
                  </button>
                  <span className="trace-page-position">
                    {tab === 'remote' ? 'Remote Pod Request Page' : 'PowerShell Page'}{' '}
                    {tracePageIndex + 1} / {tracePageCount}
                  </span>
                  <time dateTime={displayedRun?.startedAt}>
                    {formatRunDateTime(displayedRun?.startedAt)}
                  </time>
                </nav>
              )}
              {tab === 'local' && tracePageIndex === 0 && run?.status === 'running' && (
                <button onClick={stopRun}>■ Stop run</button>
              )}
              <button
                className="trace-clear"
                onClick={clearTracePage}
                title="Clear only the displayed page"
              >
                Clear
              </button>
              <button
                className="trace-clear"
                onClick={clearAllTracePages}
                title={`Clear all ${tab === 'remote' ? 'Remote Pod Request' : 'PowerShell'} pages`}
              >
                Clear all
              </button>
            </div>
            {tab === 'remote' && displayedRun?.requestBody !== undefined ? (
              <RemoteTransactionView run={displayedRun} />
            ) : (
              <pre ref={traceOutputRef} className="trace-output">
                {renderTrace(displayedOutput)}
              </pre>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
