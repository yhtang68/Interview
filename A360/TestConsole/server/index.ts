/**
 * Hosts the TestConsole API, catalog lifecycle, local execution, remote requests, and run streams.
 */

import express, { type NextFunction, type Request, type Response } from 'express';
import fs from 'node:fs/promises';
import { watch } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn, execFile, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
import {
  buildCatalog,
  formatCatalogBuildSummary,
  type Catalog,
  type CatalogBuildProgress,
  type ConfigEntry,
  type TestCaseEntry,
} from './catalog.js';
import { localRunResult } from './run-result.js';
import { localDriverArgs, testCaseArgs, testCasesYaml } from './run-selection.js';
import { needsAzureLogin } from './azure-session.js';
import { renderRemoteBody, renderRemoteUrl } from './remote-body.js';
import { resolveGitHeadPath, watchGitHead } from './git-head-watch.js';
import { createLatestLoader } from './latest-loader.js';

type RunStatus = 'queued' | 'running' | 'passed' | 'failed' | 'cancelled';

interface Run {
  id: string;
  kind: 'local' | 'remote';
  command: string;
  status: RunStatus;
  startedAt: string;
  endedAt: string | null;
  exitCode: number | null;
  output: string;
  azureReady: boolean;
  cancellationRequested: boolean;
  listeners: Set<Response>;
  process?: ChildProcessWithoutNullStreams;
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

interface RunRequest {
  config?: ConfigEntry;
  tests?: TestCaseEntry[];
  featureGroup?: string;
  browser?: string;
  logDir?: string;
  logoutAzure?: boolean;
  allure?: boolean;
  pathBranch?: string;
  testsBranch?: string;
  jobName?: string;
  userSuffix?: string;
}

interface CatalogIndexProgress extends Omit<CatalogBuildProgress, 'phase'> {
  phase: CatalogBuildProgress['phase'] | 'idle' | 'error';
}

interface RepositoryBranches {
  path: string;
  tests: string;
}

type SyncEvent =
  | { type: 'status'; version: number; branches: RepositoryBranches }
  | { type: 'catalog'; version: number }
  | { type: 'branches'; branches: RepositoryBranches };

const exec = promisify(execFile);
const here = path.dirname(fileURLToPath(import.meta.url));
const project = path.resolve(here, '..');
const defaults = JSON.parse(await fs.readFile(path.join(project, 'config/defaults.json'), 'utf8'));

const windowsUsername = () => os.userInfo().username || process.env.USERNAME || 'user';
const windowsUserSuffix = () =>
  windowsUsername()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'user';
const resolvedUserSuffix = () =>
  !defaults.podRunConfig.userSuffix || defaults.podRunConfig.userSuffix === '$WINDOWS_USER'
    ? windowsUserSuffix()
    : defaults.podRunConfig.userSuffix;

const app = express();
app.use(express.json({ limit: '1mb' }));

const runs = new Map<string, Run>();
const syncListeners = new Set<Response>();

let catalogProgress: CatalogIndexProgress = {
  phase: 'idle',
  processedFiles: 0,
  totalFiles: 0,
  percentage: 0,
};
let catalogVersion = Date.now();
let catalogChangeTimer: NodeJS.Timeout | undefined;
let branchChangeTimer: NodeJS.Timeout | undefined;
let repositoryBranchSnapshot: RepositoryBranches | undefined;
const catalogLoader = createLatestLoader({
  build: buildIndexedCatalog,
  revision: () => catalogVersion,
});

function publishSyncEvent(event: SyncEvent): void {
  const message = `data: ${JSON.stringify(event)}\n\n`;
  for (const response of syncListeners) response.write(message);
}

try {
  watch(defaults.testSource.testsRoot, { recursive: true }, (_eventType, filename) => {
    if (filename && !/\.(py|ya?ml)$/i.test(filename)) return;
    clearTimeout(catalogChangeTimer);
    catalogChangeTimer = setTimeout(() => {
      catalogLoader.invalidate();
      catalogVersion = Math.max(Date.now(), catalogVersion + 1);
      publishSyncEvent({ type: 'catalog', version: catalogVersion });
    }, 400);
  });
} catch (error) {
  console.warn(`Automatic test index watching is unavailable: ${String(error)}`);
}

async function branch(repo: string): Promise<string> {
  try {
    return (await exec('git', ['-C', repo, 'branch', '--show-current'])).stdout.trim() || 'develop';
  } catch {
    return 'develop';
  }
}

async function repositoryBranches(): Promise<RepositoryBranches> {
  const [pathBranch, testsBranch] = await Promise.all([
    branch(defaults.testSource.frameworkRepo),
    branch(defaults.testSource.testsRepo),
  ]);
  return { path: pathBranch, tests: testsBranch };
}

const sameBranches = (left: RepositoryBranches, right: RepositoryBranches) =>
  left.path === right.path && left.tests === right.tests;

async function refreshRepositoryBranches(notify: boolean): Promise<RepositoryBranches> {
  const branches = await repositoryBranches();
  const changed = repositoryBranchSnapshot && !sameBranches(repositoryBranchSnapshot, branches);
  repositoryBranchSnapshot = branches;
  if (notify && changed) publishSyncEvent({ type: 'branches', branches });
  return branches;
}

async function gitHeadPath(repo: string): Promise<string> {
  const gitPath = (await exec('git', ['-C', repo, 'rev-parse', '--git-path', 'HEAD'])).stdout.trim();
  return resolveGitHeadPath(repo, gitPath);
}

async function watchRepositoryBranches(): Promise<void> {
  const headPaths = await Promise.all([
    gitHeadPath(defaults.testSource.frameworkRepo),
    gitHeadPath(defaults.testSource.testsRepo),
  ]);
  await refreshRepositoryBranches(false);
  for (const headPath of new Set(headPaths)) {
    const watcher = watchGitHead(headPath, () => {
      clearTimeout(branchChangeTimer);
      branchChangeTimer = setTimeout(() => {
        void refreshRepositoryBranches(true).catch((error) => {
          console.warn(`Git branch refresh failed: ${String(error)}`);
        });
      }, 200);
    });
    watcher.on('error', (error) => {
      console.warn(`Git branch watching is unavailable for ${headPath}: ${String(error)}`);
    });
  }
}

async function commit(repo: string): Promise<string> {
  try {
    return (await exec('git', ['-C', repo, 'rev-parse', 'HEAD'])).stdout.trim() || 'unknown';
  } catch {
    return 'unknown';
  }
}

async function buildIndexedCatalog(): Promise<Catalog> {
  const startedAt = performance.now();
  console.log('Catalog indexing started...');
  try {
    const catalog = await buildCatalog(defaults.testSource.testsRoot, (progress) => {
      catalogProgress = progress;
    });
    console.log(formatCatalogBuildSummary(catalogProgress.totalFiles, performance.now() - startedAt));
    return catalog;
  } catch (error) {
    catalogProgress = { ...catalogProgress, phase: 'error' };
    console.error(
      `Catalog indexing failed after ${Math.round(performance.now() - startedAt)}ms: ${error instanceof Error ? error.message : String(error)}`,
    );
    throw error;
  }
}

const loadCatalog = (force = false) => catalogLoader.load(force);

function publicRun(run: Run) {
  return {
    ...run,
    process: undefined,
    listeners: undefined,
    cancellationRequested: undefined,
  };
}

function powershellQuote(value: string): string {
  return '"' + value.replace(/"/g, '`"') + '"';
}

function createRun(kind: Run['kind'], command: string): Run {
  const id = crypto.randomUUID();
  const run: Run = {
    id,
    kind,
    command,
    status: 'queued',
    startedAt: new Date().toISOString(),
    endedAt: null,
    exitCode: null,
    output: '',
    azureReady: false,
    cancellationRequested: false,
    listeners: new Set<Response>(),
  };
  runs.set(id, run);
  return run;
}

function write(run: Run, message: string, event: Record<string, unknown> = {}): void {
  run.output = (run.output + message).slice(-500000);
  for (const response of run.listeners)
    response.write(
      `data: ${JSON.stringify({ output: message, status: run.status, exitCode: run.exitCode, ...event })}\n\n`,
    );
}

const azureKeyVaultCheckDisplay =
  'az account get-access-token --resource https://vault.azure.net --output none';

async function validateAzureKeyVaultSession(): Promise<void> {
  const args = [
    'account',
    'get-access-token',
    '--resource',
    'https://vault.azure.net',
    '--output',
    'none',
  ];
  // Azure CLI is installed as az.cmd on Windows, so resolve it through cmd.exe
  // using a fixed command. Other platforms can execute az directly.
  if (process.platform === 'win32') {
    await exec(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', azureKeyVaultCheckDisplay]);
  } else {
    await exec('az', args);
  }
}

async function logoutAzureSession(): Promise<void> {
  if (process.platform === 'win32') {
    await exec(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', 'az logout --output none']);
  } else {
    await exec('az', ['logout', '--output', 'none']);
  }
}

async function ensureAzureSession(run: Run, flushSession: boolean): Promise<void> {
  let sessionActive = false;
  if (flushSession) {
    write(run, '[Azure] Mode: flush session and login.\n[Azure] > az logout --output none\n');
    try {
      await logoutAzureSession();
      write(run, '[Azure] Existing Azure CLI session was logged out.\n');
    } catch (error) {
      const reason = error instanceof Error ? error.message.split(/\r?\n/, 1)[0] : String(error);
      write(run, `[Azure] Logout reported: ${reason}\n[Azure] Continuing with a fresh login.\n`);
    }
    write(run, '[Azure] > az login --allow-no-subscriptions --output none\n');
  } else {
    write(run, `[Azure] Mode: smart session check.\n[Azure] > ${azureKeyVaultCheckDisplay}\n`);
    try {
      await validateAzureKeyVaultSession();
      sessionActive = true;
      write(run, '[Azure] Key Vault token is available; reusing the existing Azure session.\n\n', {
        azureReady: true,
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message.split(/\r?\n/, 1)[0] : String(error);
      write(
        run,
        `[Azure] Key Vault session check failed: ${reason}\n[Azure] Starting az login...\n`,
      );
    }
  }

  if (!needsAzureLogin(sessionActive, flushSession)) return;
  write(run, '[Azure] Complete the browser sign-in opened by Azure CLI. PATHCLI will wait.\n\n');
  await new Promise<void>((resolve, reject) => {
    const login = spawn('az', ['login', '--allow-no-subscriptions', '--output', 'none'], {
      shell: true,
      windowsHide: false,
    });
    run.process = login;
    login.stdout.on('data', (data) => write(run, data.toString()));
    login.stderr.on('data', (data) => write(run, data.toString()));
    login.on('error', reject);
    login.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`az login exited with code ${code ?? 'unknown'}.`));
    });
  });
  run.process = undefined;
  write(
    run,
    `\n[Azure] Login completed. Verifying the Key Vault token...\n[Azure] > ${azureKeyVaultCheckDisplay}\n`,
  );
  await validateAzureKeyVaultSession();
  write(run, '[Azure] Key Vault token verification succeeded; the session is ready.\n\n', {
    azureReady: true,
  });
}

function finish(run: Run, status: RunStatus, exitCode: number | null = null): void {
  if (['passed', 'failed', 'cancelled'].includes(run.status)) return;
  run.status = status;
  run.exitCode = exitCode;
  run.endedAt = new Date().toISOString();
  write(run, '');
  for (const response of run.listeners) response.end();
  run.listeners.clear();
}

function requireSelection(
  body: RunRequest,
): asserts body is RunRequest & { config: ConfigEntry; tests?: TestCaseEntry[] } {
  if (!body.config?.file) throw new Error('Choose one test suite config.');
  if (body.tests !== undefined && !Array.isArray(body.tests))
    throw new Error('Test cases must be an array when provided.');
}

function safeJobName(branchName: string, suffix: string): string {
  const ticket = branchName
    .split('/')
    .at(-1)!
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
  const stem = ticket === 'develop' ? 'develop' : ticket;
  return `trading-${stem}-${suffix || 'local'}`.replace(/-+/g, '-').slice(0, 63);
}

app.get('/api/bootstrap', async (_req, res, next) => {
  try {
    const username = windowsUsername();
    const domain = process.env.USERDOMAIN || os.hostname();
    const appRepo = path.resolve(project, '..');
    const [branches, testCodeCommit, appCommit, loadedCatalog] = await Promise.all([
      refreshRepositoryBranches(true),
      commit(defaults.testSource.testsRepo),
      commit(appRepo),
      loadCatalog(),
    ]);
    res.json({
      defaults: {
        ...defaults,
        podRunConfig: { ...defaults.podRunConfig, userSuffix: resolvedUserSuffix() },
      },
      branches,
      commits: { tests: testCodeCommit, app: appCommit },
      user: { username, domain, identity: domain ? domain + '\\' + username : username },
      catalog: loadedCatalog,
    });
  } catch (error) {
    next(error);
  }
});

app.get('/api/catalog/version', (_req, res) => res.json({ version: catalogVersion }));

app.get('/api/sync/status', async (_req, res, next) => {
  try {
    res.json({ version: catalogVersion, branches: await refreshRepositoryBranches(true) });
  } catch (error) {
    next(error);
  }
});

app.get('/api/sync/events', async (req, res) => {
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });
  res.flushHeaders();
  syncListeners.add(res);
  req.on('close', () => syncListeners.delete(res));
  const branches = await refreshRepositoryBranches(true);
  res.write(
    `retry: 3000\ndata: ${JSON.stringify({ type: 'status', version: catalogVersion, branches })}\n\n`,
  );
});

app.get('/api/catalog/progress', (_req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json(catalogProgress);
});

app.post('/api/catalog/refresh', async (_req, res, next) => {
  try {
    res.json(await loadCatalog(true));
  } catch (error) {
    next(error);
  }
});

app.get('/api/runs', (_req, res) =>
  res.json([...runs.values()].reverse().slice(0, 25).map(publicRun)),
);

app.get('/api/runs/:id/events', (req, res) => {
  const run = runs.get(req.params.id);
  if (!run) return res.sendStatus(404);
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });
  res.flushHeaders();
  res.write(
    `data: ${JSON.stringify({ output: run.output, status: run.status, exitCode: run.exitCode, azureReady: run.azureReady, requestUrl: run.requestUrl, requestHeaders: run.requestHeaders, requestBody: run.requestBody, responseHeaders: run.responseHeaders, responseBody: run.responseBody, httpStatus: run.httpStatus })}\n\n`,
  );
  if (['passed', 'failed', 'cancelled'].includes(run.status)) return res.end();
  run.listeners.add(res);
  req.on('close', () => run.listeners.delete(res));
});

app.post('/api/runs/:id/cancel', async (req, res) => {
  const run = runs.get(req.params.id);
  if (!run) return res.sendStatus(404);
  if (run.process && run.status === 'running') {
    const pid = run.process.pid;
    run.cancellationRequested = true;
    write(run, '\n[Runner] Stop requested. Terminating the PATHCLI process tree...\n');
    try {
      if (process.platform === 'win32' && pid)
        await exec('taskkill', ['/PID', String(pid), '/T', '/F']);
      else run.process.kill('SIGTERM');
    } catch (error) {
      write(
        run,
        `[Runner] Process-tree termination reported: ${error instanceof Error ? error.message : String(error)}\n`,
      );
    }
    finish(run, 'cancelled');
  }
  res.json(publicRun(run));
});

app.post('/api/run/local', async (req, res, next) => {
  try {
    requireSelection(req.body);
    const pythonScripts = path.join(defaults.localRunConfig.venvPath, 'Scripts');
    const pathcli = path.join(pythonScripts, 'pathcli.exe');
    const selectedTestNames = (req.body.tests ?? []).map((test) => test.name);
    const browser = req.body.browser ?? defaults.localRunConfig.browser;
    const args = [
      '--log-env',
      '--log-dir',
      req.body.logDir || defaults.localRunConfig.logDir,
      'run',
      req.body.config.file,
      ...localDriverArgs(browser),
      ...testCaseArgs(selectedTestNames),
    ];
    if (req.body.allure === true) args.push('--allure');
    const commandParts = [
      powershellQuote(pathcli),
      '--log-env',
      `--log-dir ${powershellQuote(req.body.logDir || defaults.localRunConfig.logDir)}`,
      `run ${powershellQuote(req.body.config.file)}`,
      ...(browser && browser !== 'config' ? [`--localdriver ${powershellQuote(browser)}`] : []),
      ...(selectedTestNames.length
        ? [`--test-cases ${selectedTestNames.map((test) => powershellQuote(test)).join(' ')}`]
        : []),
      ...(req.body.allure === true ? ['--allure'] : []),
    ];
    const command = commandParts.join(' `\n>> ');
    const run = createRun('local', command);
    res.status(202).json(publicRun(run));
    run.status = 'running';
    write(run, '[Local] Preparing the test run.\n');
    try {
      await ensureAzureSession(run, req.body.logoutAzure === true);
    } catch (error) {
      if (run.cancellationRequested || runs.get(run.id)?.status === 'cancelled') {
        finish(run, 'cancelled');
        return;
      }
      write(
        run,
        `\n[Azure] Login failed: ${error instanceof Error ? error.message : String(error)}\n`,
      );
      finish(run, 'failed', -1);
      return;
    }
    write(
      run,
      `${browser === 'config' ? '[PATHCLI] No local driver override; using the remote browser defined by the test config.\n' : ''}${selectedTestNames.length ? '' : '[PATHCLI] No test cases checked; running the entire test suite.\n'}[PATHCLI] Starting test process.\n> ${command}\n\n`,
    );
    const child = spawn(pathcli, args, {
      cwd: defaults.testSource.testsRepo,
      env: {
        ...process.env,
        PATH: `${pythonScripts};${process.env.PATH || ''}`,
        PYTHONUTF8: '1',
        PYTHONIOENCODING: 'utf-8',
      },
    });
    run.process = child;
    child.stdout.on('data', (x) => write(run, x.toString()));
    child.stderr.on('data', (x) => write(run, x.toString()));
    child.on('error', (error) => {
      write(run, `\n${error instanceof Error ? error.message : String(error)}\n`);
      const result = localRunResult(run.output, -1, run.cancellationRequested);
      finish(run, result.status, result.exitCode);
    });
    child.on('close', (code) => {
      const result = localRunResult(run.output, code, run.cancellationRequested);
      finish(run, result.status, result.exitCode);
    });
  } catch (error) {
    next(error);
  }
});

app.post('/api/run/remote', async (req, res, next) => {
  try {
    requireSelection(req.body);
    const pathBranch = req.body.pathBranch || (await branch(defaults.testSource.frameworkRepo));
    const testsBranch = req.body.testsBranch || (await branch(defaults.testSource.testsRepo));
    const userSuffix = req.body.userSuffix || resolvedUserSuffix();
    const jobName = req.body.jobName || safeJobName(testsBranch, userSuffix);
    const url = renderRemoteUrl(defaults.podRunConfig.host, defaults.podRunConfig.params, {
      pathBranch,
      testsBranch,
      jobName,
    });
    const selectedTestNames = (req.body.tests ?? []).map((test) => test.name);
    const featureGroup = req.body.featureGroup || defaults.testSource.featureGroup;
    const yaml = renderRemoteBody(defaults.podRunConfig.body, {
      featureGroup,
      configName: req.body.config.name,
      jobName,
      testCasesBlock: testCasesYaml(selectedTestNames),
    });
    const requestHeaders = { accept: 'application/json', 'content-type': 'text/html' };
    const run = createRun('remote', `POST ${url}\n\n${yaml}`);
    run.requestUrl = url;
    run.requestHeaders = requestHeaders;
    run.requestBody = yaml;
    run.pathBranch = pathBranch;
    run.testsBranch = testsBranch;
    run.jobName = jobName;
    run.userSuffix = userSuffix;
    res.status(202).json(publicRun(run));
    run.status = 'running';
    write(run, '[Remote Pod] Submitting REST request...\n');
    try {
      const response = await fetch(url, { method: 'POST', headers: requestHeaders, body: yaml });
      const body = await response.text();
      let responseBody: unknown = body;
      try {
        responseBody = JSON.parse(body);
      } catch {
        /* Preserve non-JSON error responses as text. */
      }
      const responseHeaders = Object.fromEntries(response.headers.entries());
      run.responseHeaders = responseHeaders;
      run.responseBody = responseBody;
      run.httpStatus = response.status;
      write(run, `[Remote Pod] HTTP ${response.status} ${response.statusText}\n`, {
        responseHeaders,
        responseBody,
        httpStatus: response.status,
      });
      finish(run, response.ok ? 'passed' : 'failed', response.status);
    } catch (error) {
      write(run, `${error instanceof Error ? error.message : String(error)}\n`);
      finish(run, 'failed', -1);
    }
  } catch (error) {
    next(error);
  }
});

app.use(express.static(path.join(project, 'dist')));

app.get(/.*/, (_req, res) => res.sendFile(path.join(project, 'dist/index.html')));

app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) =>
  res.status(400).json({ error: error instanceof Error ? error.message : String(error) }),
);

app.listen(4310, '127.0.0.1', () => {
  console.log('Test Console API: http://127.0.0.1:4310');
  void watchRepositoryBranches().catch((error) => {
    console.warn(`Automatic Git branch watching is unavailable: ${String(error)}`);
  });
  void loadCatalog().catch(() => {
    /* loadCatalog reports startup indexing failures; bootstrap will surface them in the UI. */
  });
});
