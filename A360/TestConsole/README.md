# PATH Test Console

**Last update (Eastern Time):** August 20, 2026 12:08 AM Eastern Time

A local Node.js + React + TypeScript console for finding, configuring, and running PATH tests. The UI follows the familiar Postman model: searchable collection on the left, request/run configuration in the center, and a live execution trace below.

## Table of contents

- [What it does](#what-it-does)
  - [Search](#search)
    - [Feature Group (Feature Team)](#feature-group-feature-team)
    - [Test Suite](#test-suite)
    - [Test Case](#test-case)
  - [Run locally](#run-locally)
  - [Run remotely on Pod](#run-remotely-on-pod)
- [Project layout](#project-layout)
- [Dedicated VS Code workspace](#dedicated-vs-code-workspace)
- [Platform support](#platform-support)
- [Prerequisites](#prerequisites)
- [Install and run](#install-and-run)
  - [Dev Build (Recommended)](#dev-build-recommended)
  - [Product Build](#product-build)
- [Workflow](#workflow)
- [History](#history)
- [Startup performance and cache](#startup-performance-and-cache)
- [Run on Local PowerShell](#run-on-local-powershell)
  - [PATH CLI contract](#path-cli-contract)
  - [Local command](#local-command)
- [Run on Remote Pod](#run-on-remote-pod)
  - [Remote request](#remote-request)
- [Configuration](#configuration)
- [Checks](#checks)
- [Current scope](#current-scope)

## What it does

### Search

#### Feature Group (Feature Team)

- Indexes feature groups below `C:\PATH_Project\qa-pathtestsuites\tests`, with `trading` selected by default.
- Supports switching Feature Groups while keeping the searchable library scoped to the selected group.
- Automatically detects `.py`, `.yaml`, and `.yml` changes and refreshes the **Test Index** without requiring a page reload.
- Use **Force index** for an immediate full rescan and branch-status refresh when filesystem watching is unavailable.

#### Test Suite

A Test Suite is defined by two related files:

- **Test Suite Config** — the YAML file that names and configures the Test Suite for an environment. The index reads its `environment.name` and `environment.testsuite` values.
  - Example name: `C360_GROUP_BY_ACCOUNT_UI_CFN_QA_{browser_name}`
  - Example file: `C:\PATH_Project\qa-pathtestsuites\tests\trading\ui\C360\c360_trading_holding\group_by\c360_account\config\c360_account_cfn_qa_web.yaml`
- **Test Suite File** — the Python file that contains the Test Suite implementation and its runnable Test Cases.
  - Example file: `C:\PATH_Project\qa-pathtestsuites\tests\trading\ui\C360\c360_trading_holding\group_by\c360_account\c360_account.py`

Search supports the Test Suite name, YAML or Python filename, and full path, then shows the related Test Cases.

#### Test Case

- Extracts runnable test cases from Python `TestCase` subclasses.
- Searches by Test Case name, Python filename, or full path and shows the compatible Test Suites.

### Run locally

- Runs selected cases or an entire suite through the existing PATH virtual environment.
- Validates a Key Vault token before every run: **AZ Smart Session Check** reuses a valid session, while **AZ Logout then Login** flushes the Azure CLI session and signs in again.
- Streams stdout/stderr into the execution trace and supports stopping the run.

### Run remotely on Pod

- Submits proof-of-truth runs to [`https://qa-automation.advisor360.com/pathapi/builds/debugpod`](https://qa-automation.advisor360.com/pathapi/builds/debugpod).
- Defaults both remote branches to the current local Git branches.
- Detects live Git checkouts through filesystem events. Current local values follow the checkout, while explicit `develop`, custom, and History-restored Remote Pod values remain unchanged and their mismatch indicators are recalculated.

## Project layout

All application source is TypeScript. `src/main.tsx` composes the app and owns shared run/configuration state; `server/index.ts` hosts the Express API; and `server/catalog.ts` discovers tests and configs. Strict compiler settings live in `tsconfig.json`.

The React UI is split into scoped feature boundaries:

- `app-header.tsx` and `navigation-rail.tsx` render the application shell.
- `side-panel.tsx` provides the shared resizable/collapsible panel frame.
- `runner-search-panel.tsx` and `history-panel.tsx` render the two side-panel features.
- `remote-branch-fields.tsx` renders controlled, editable Remote Pod branch fields and common branch shortcuts.
- `search.ts`, `history.ts`, and `history-view.ts` contain non-React search, persistence, and grouping logic.
- Each extracted component owns a matching `.module.css`; `styles.css` retains the central Runner workspace styles that have not yet been extracted.

Automated tests live outside production source in a mirrored tree: `test/server` covers API/catalog/run helpers, `test/src` covers client-domain logic, and `test/scripts` covers development/process scripts.

See [`tech-debt.md`](tech-debt.md) for the risk-tiered plan to continue decomposing `main.tsx` and, later, clarify the functional and object-oriented boundaries in `server/index.ts`.

The console follows the sibling-repository layout defined by `..\PATH_Project.trading.code-workspace`: `qa-path`, `qa-pathtestsuites`, `TRAD-Test-Automation`, and the shared `venv` all live below `C:\PATH_Project`.

## Dedicated VS Code workspace

Open [TestConsole.code-workspace](TestConsole.code-workspace) when working on this application. It is intentionally separate from the parent Python testing workspace and provides TypeScript formatting, extension recommendations, npm tasks, and server/browser debugging. In VS Code, choose **File → Open Workspace from File…** and select it.

## Platform support

The current project and source-controlled defaults target Windows. Local execution expects `C:\PATH_Project`, `venv\Scripts\pathcli.exe`, and the existing Windows PATH/Azure setup.

The Node.js server can read the signed-in username on macOS through `os.userInfo()`, so the `$WINDOWS_USER` setting still resolves technically, although the token name reflects the current Windows-first scope. Remote Pod submission is platform-independent once valid repository paths are configured.

Full macOS local-run support would require platform-specific repository defaults, `venv/bin/pathcli` instead of `venv\Scripts\pathcli.exe`, and native shell/process handling where Windows assumptions remain. A future cross-platform version should rename `$WINDOWS_USER` to `$CURRENT_USER` while retaining the old token for compatibility.

## Prerequisites

The existing PATH setup remains the source of truth:

- Node.js 24+ / npm 11+
- `C:\PATH_Project\venv` with `pathcli`
- `qa-path` and `qa-pathtestsuites` sibling checkouts
- Azure CLI and active PIM membership for local Key Vault access
- Allure CLI + Java when **Generate Allure report** is enabled

Allure is disabled by default so its report server cannot keep a completed local run open. Enable it only when a generated report is needed.

See the parent [`README.md`](../README.md), especially **4. Test User Access** and **5. Test Run**.

## Install and run

### Dev Build (Recommended)

```powershell
cd C:\PATH_Project\TRAD-Test-Automation\TestConsole
npm install
npm run dev
```

- Open [`http://localhost:5173`](http://localhost:5173)
  - Live Source
- Open [`http://127.0.0.1:4310`](http://127.0.0.1:4310)
  - Last Product Build

Press `Ctrl+C` for the normal coordinated shutdown. If a previous terminal left the API or UI listener behind, run `npm run stop`. The stop command verifies that listeners on ports `4310` and `5173` belong to this TestConsole project and refuses to terminate unrecognized processes.

Development output is prefixed with the computer's local date and time in the terminal and appended to the daily TestConsole log at
`%LOCALAPPDATA%\A360\PATH\TestConsole\logs\test-console-YYYY-MM-DD.log`. The absolute path is printed when
`npm run dev` starts. All API and UI output is retained, including repeated proxy failures during watched source updates.

### Product Build

```powershell
npm run build
npm start
```

- Open [`http://127.0.0.1:4310`](http://127.0.0.1:4310)
  - Static Source

## Workflow

1. Use [Search](#search) to choose a Feature Group and find a Test Case or Test Suite.
2. Select a compatible Test Suite, then check specific Test Cases or leave them unchecked to run the entire suite.
3. [Run locally](#run-locally), fix the test in the source file shown by the app, and rerun until it passes.
4. [Run remotely on Pod](#run-remotely-on-pod) as the proof-of-truth run.

## History

Local PowerShell and Remote Pod runs are saved in browser IndexedDB as soon as they start and organized as:

- Date
  - Test Suite
    - Local PowerShell
      - Run time
    - Remote Pod
      - PATH branch + Test branch
        - Request time

History works as a second left-side library alongside Search:

- Open or fold it with the **History** rail button while Runner remains visible.
- Filter by Test Suite name, Test Suite filename/path, Test Case name, or saved Remote Pod branch.
- Scan compact tenant/stage badges such as **CFN / QA**; hover the suite label for its complete configured name.
- Fold or expand each date, Test Suite, and run type (Local PowerShell or Remote Pod) group independently, then select a saved time to restore the Test Config, run mode, selected Test Cases, status, and output in Runner.
- Remote Pod entries are grouped by their recorded PATH and Test repository branch pair. Loading one restores its historical Pod settings, while the header continues to show the current local branches and Runner warns when they differ.
- Returning from History to Runner resets only the Remote Pod PATH and Test branches to the detected Current local branches. Test selection, Local PowerShell configuration, user suffix, job name, log settings, and other run options remain unchanged.
- Selecting another History record while a run is active previews archived output without replacing the live run or stream. Selecting the active run's own History entry returns to its live trace.
- History stays open after loading a run until it is explicitly folded.
- A new run appears in History as **Running** while it executes. It is updated to **Passed** or **Failed** when it finishes; stopped runs and runs interrupted before completion become **Incomplete** with the output captured so far.
- Local results use the PATH summary (`Failed` count and `Run Status`) before the process exit code, because `pathcli` can return exit code `0` even when a test failed.
- Each new History entry records the qa-pathtestsuites **Test Code commit** and the TRAD-Test-Automation **App commit** silently. Normal History cards do not display version details. Commit fingerprints appear only as debugging context when the current Test Index cannot resolve a saved Test Suite file or Test Case.

By default, the app retains History for 7 days and keeps at most the newest 50 Local runs and 50 Remote Pod runs. Set `historyConfig.retentionDays` in `config/defaults.json` from 1 through 14 days. Expired records are removed from IndexedDB when History loads or a completed run is saved. History belongs to the current browser profile and app origin, so [localhost:5173](http://localhost:5173) and [127.0.0.1:4310](http://127.0.0.1:4310) keep separate histories.

`Clear` and `Clear all` on a run console remove that console's current or paged output. They do not delete saved IndexedDB History. Clear the browser's site data when the saved History itself needs to be removed.

## Startup performance and cache

The Test Index is intentionally memory-only. The API begins a cold recursive scan of the configured `.py`, `.yaml`, and
`.yml` sources immediately after it starts listening, so indexing overlaps Vite startup and the time before the browser is
opened. Bootstrap joins the existing build instead of starting another one, then the catalog remains in memory for the
service lifetime. No `TestConsole/.cache` directory or `test-catalog.json` file is created.

Representative local startup measurements from a fully stopped server:

| Stage | Time |
| --- | ---: |
| API ready | 0.06 seconds |
| Cold catalog build (18,505 files) | 7.6 seconds |
| Bootstrap after eager indexing | 0.25 seconds |
| Browser console usable | 8.75 seconds |
| Warm browser load | 1.26 seconds |

- **Browser console usable** is the total practical cold-start time from opening the page until Test Console is ready.
- **Warm browser load** means opening another tab or reloading while the server is running and its catalog remains in
  memory.
- The terminal logs when indexing starts, then reports the measured file count and build duration. While bootstrap waits,
  the browser displays measured indexing progress rather than an indeterminate loading message.
- During development, the terminal also shows a compact animated spinner while catalog indexing is active. It clears
  before normal API/UI output and is omitted automatically when output is redirected. Set
  `developmentConfig.terminalSpinnerStyle` in `config/defaults.json` to `braille` for the smooth dot animation or
  `classic` (the default) for the traditional `| / - \` animation.

The measured bootstrap response was approximately 28.75 MiB. Because Test Console normally starts once with the machine
and remains available as a local service, the sub-10-second cold start is an acceptable one-time cost. A persistent JSON
cache would add full-catalog serialization, atomic file replacement, invalidation rules, corruption recovery, branch and
uncommitted-file validation, and write amplification whenever tests change. That complexity is not currently justified by
the startup savings.

While the service is running:

- Searches and navigation use the in-memory catalog and do not reread a cache file.
- The browser checks the in-memory catalog version every two seconds; this check performs no cache-file I/O.
- The filesystem watcher invalidates the catalog after `.py`, `.yaml`, or `.yml` changes, and an open Test Console
  triggers a fresh catalog build.
- **Last synced** records the latest successful catalog-version synchronization check.
- **Force index** performs an immediate complete rebuild from source.

If catalog growth makes cold startup materially slower, optimize changed-file handling in memory first. Persistent
storage should be reconsidered only when measured restart performance warrants its additional maintenance and correctness
costs.

## Run on Local PowerShell

### PATH CLI contract

See the parent [`README.md` — 5. Test Run](../README.md#5-test-run) for the PATH CLI contract, supported commands, environment setup, and canonical test-run examples. The Test Console invokes the same `pathcli` workflow through its local runner.

### Local command

The server launches the venv's `pathcli.exe` directly (equivalent to activating the venv) with an argument array, not a string passed through a shell:

```text
C:\PATH_Project\venv\Scripts\pathcli.exe --log-env --log-dir <logs> run <absolute-config.yaml> --localdriver chrome --test-cases <TestA> <TestB> --allure
```

Choose **Use config (remote browser)** in the Browser control to omit `--localdriver` and use the browser defined by the selected YAML. Choosing Chrome, Edge, or Firefox adds `--localdriver` as an explicit local override.

This avoids PowerShell quoting issues and keeps user selections out of shell evaluation. The process runs from the `qa-pathtestsuites` checkout.

## Run on Remote Pod

### Remote request

The Remote Pod request is:

```http
POST https://qa-automation.advisor360.com/pathapi/builds/debugpod
  ?path_branch=<current qa-path branch>
  &tests_branch=<current qa-pathtestsuites branch>
  &jobname=<derived job name>
  &publish=false&cache=false&numprocesses=1
Content-Type: text/html
```

- The request body is PATH job YAML containing the selected config and test cases.
- PATH and Test branch fields remain freely editable. Each dropdown offers `develop` and, when different, the detected
  **Current local** branch. The **Branch preset** control identifies Current local, `develop`, or custom values and updates
  both fields atomically when a preset is selected.
- Loading a Remote Pod History entry restores its saved branch values even when they are custom branches that do not
  appear among the current dropdown shortcuts.
- The default job-name format is `trading-<test-branch>-<user-suffix>`.
- Example: branch `ATANG/TRAD-18941-CFN-QA` and suffix `atang` produce `trading-trad-18941-cfn-qa-atang`.
- The job name can be manually updated in the app UI; be aware of the Kubernetes 63-character limit.

## Configuration

See [`config/README.md`](config/README.md) for the current source-controlled defaults and comments explaining each setting.

## Checks

```powershell
npm run check
```

The complete check runs ESLint, TypeScript, the production build, and automated tests. Individual commands are also available:

```powershell
npm run lint
npm run typecheck
npm test
npm run build
```

Test discovery uses `test/**/*.test.ts`; place new tests in the matching `test/server`, `test/src`, or `test/scripts` directory rather than beside production modules.

## Current scope

- The **Test Index** is read-only; Python tests and YAML configs remain editable in the user's IDE.
- One **Test Config** is used per run and can be rerun.
- **History** stores Local PowerShell and Remote Pod runs in browser IndexedDB from the moment they start, updating each entry as it finishes. It is a searchable, foldable side panel that restores saved runs into Runner. Retention is configured for 1–14 days and defaults to 7 days.
- The Test Index is memory-only by design and resets with the server; measured cold startup is currently under 10 seconds.
- **Settings** remains a placeholder for future persistent personal preferences.
- Cookies are not used. The theme is saved in browser localStorage; saved History uses IndexedDB; other UI preferences reset on reload and start from the source-controlled defaults.
- Active run state is held in server memory and resets when the server restarts. Saved History remains available in the browser.
- Remote cancellation is not exposed because the Remote Pod API supports submission but does not provide a cancellation endpoint.
