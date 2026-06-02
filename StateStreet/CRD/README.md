# STATE STREET - CRD - Portfolio Rebalancing QA Assessment

This repository contains the automated QA implementation for the CRD
portfolio-rebalancing assessment.

For the solution design, assumptions, calculations, delivery plan, and current
state, see [WORK_SPEC.md](./docs/WORK_SPEC.md).

## Table Of Contents

- [Assignment](#assignment)
- [Architecture Decision](#architecture-decision)
- [Tech Stack](#tech-stack)
- [Install](#install)
- [Cucumber.js](#cucumberjs)
- [Static Checks](#static-checks)
- [Test Run](#test-run)
- [Test Results](#test-results)

## Assignment

The assignment source is available in:

- [North American - Technical Assessment QA.md](./docs/North%20American%20-%20Technical%20Assessment%20QA.md)
- [North American - Technical Assessment QA.docx](./docs/North%20American%20-%20Technical%20Assessment%20QA.docx)
- [North American - Technical Assessment QA.pdf](./docs/North%20American%20-%20Technical%20Assessment%20QA.pdf)

## Architecture Decision

This project uses a lightweight API-test stack built around PowerShell, Node.js,
npm, Bun, Cucumber.js, TypeScript, ESLint, gplint, WireMock, Java, and Allure.

The approach keeps the infrastructure small and discussion-friendly.

The local workflow is intentionally simple:

1. **PowerShell** provides readable entry points for Windows development.
2. **Bun** launches the package scripts and local JavaScript tooling.
3. **Cucumber.js** executes interview-readable Gherkin scenarios.
4. **TypeScript** implements the step definitions and typed Cucumber World.
5. **WireMock** supplies deterministic API fixtures without requiring a live
   service.
6. **npm** installs dependencies and maintains the lockfile for the toolchain.

## Tech Stack

| Tool | Version | Purpose | Public Reference |
| --- | --- | --- | --- |
| Allure Report | `2.42.0` | Interactive test report generator | [allure-commandline - npm README](https://www.npmjs.com/package/allure-commandline) |
| Bun | `1.3.14` | Script runner | [Bun - Docs](https://bun.sh/docs) |
| Cucumber.js | `12.5.0` | BDD test runner | [@cucumber/cucumber - npm README](https://www.npmjs.com/package/@cucumber/cucumber) |
| ESLint | `9.39.4` | JavaScript and TypeScript linter | [eslint - npm README](https://www.npmjs.com/package/eslint) |
| gplint | `2.5.2` | Gherkin feature-file linter | [gplint - npm README](https://www.npmjs.com/package/gplint) |
| Java | `25.0.2 LTS` | Runtime for WireMock and Allure Report | [Java - Docs](https://docs.oracle.com/en/java/) |
| Node.js | `22.22.1` | JavaScript runtime | [Node.js - Docs](https://nodejs.org/docs/latest/api/) |
| npm | `11.11.1` | Package manager | [npm - CLI Docs](https://docs.npmjs.com/cli/) |
| PowerShell | `7.6.2` | Windows automation shell | [PowerShell - Docs](https://learn.microsoft.com/powershell/) |
| TypeScript | `5.9.3` | Typed JavaScript language | [typescript - npm README](https://www.npmjs.com/package/typescript) |
| WireMock | `3.13.2` | HTTP API mock server | [wiremock - npm README](https://www.npmjs.com/package/wiremock) |

- The **VS Code Workspace** is configured for the `Cucumber (Gherkin) Full
  Support` extension (`alexkrechik.cucumberautocomplete`) so `.feature` files
  can resolve the TypeScript steps in `src/step_definitions`.
- **Cucumber.js** is pinned to the `12.5.x` release line because the configured
  pretty formatter still uses `colorsEnabled`. Newer Cucumber.js releases
  deprecate that option before the pretty formatter fully supports the
  `FORCE_COLOR` replacement.
- **npm and Bun** have intentionally separate roles in this repository:

  | Command | Purpose |
  | --- | --- |
  | `npm install` | Install dependencies and maintain `package-lock.json`. |
  | `bun run <script>` | Run a script defined in `package.json`. |
  | `bunx <command>` | Run a local package executable such as `cucumber-js` or `tsc`. |

  Avoid `bun install` so npm remains the dependency-locking source of truth.

## Install

Install dependencies from the repository root:

```powershell
npm install
```

Confirm the local tool versions:

```powershell
node --version
npm --version
bun --version
$PSVersionTable.PSVersion
java --version
bunx cucumber-js --version
```

## Cucumber.js

Test execution starts with `.\run-tests.ps1`. The runner invokes
`bunx cucumber-js --config config/env/<environment>.api.conf.js`, and the
selected environment profile calls the shared builder in `config/api-test.js`.

The Cucumber.js infrastructure is organized as follows:

| File | Feature |
| --- | --- |
| [`run-tests.ps1`](./run-tests.ps1) | - Provides the key local test-runner entry point.<br>- Accepts or prompts for an environment and optional feature selection.<br>- Validates and selects `config/env/<environment>.api.conf.js` at runtime.<br>- Prints the resolved run config and enables colored output.<br>- Launches the local Cucumber.js version through `bunx` and returns its exit code for CI. |
| [`features/`](./features) | Contains self-documented Gherkin scenarios organized by product behavior. |
| [`config/env/local.api.conf.js`](./config/env/local.api.conf.js) | - Supplies environment-specific values and calls the shared config builder.<br>- Defines the WireMock host and the CRD portfolio product URL currently served by that mock. |
| [`config/api-test.js`](./config/api-test.js) | - Builds the shared Cucumber profile.<br>- Exposes environment values through `worldParameters`.<br>- Defines timeout and retry defaults as the suite grows.<br>- Writes JUnit XML and Allure result data.<br>- Adds test runner, runner user, environment, and timezone metadata to Allure. |
| [`src/step_definitions/`](./src/step_definitions) | - Organizes thin step definitions by product behavior.<br>- Translates Gherkin tables into typed service calls and focused assertions.<br>- Stores response data for failure diagnostics. |
| [`src/services/`](./src/services) | Owns product behavior, endpoint calls, portfolio calculations, and WireMock administration. |
| [`src/services/crd_PortfolioService.ts`](./src/services/crd_PortfolioService.ts) | - Defines the CRD portfolio contract and readable endpoint tree.<br>- Calls the mocked product endpoint.<br>- Lists, clears, and resets mocked portfolio accounts.<br>- Preserves account-level `Total Asset` metadata and validates security current values against allocation percentages.<br>- Refreshes the mocked account-name collection when dynamic accounts are published.<br>- Refreshes derived asset metadata and updates scenario-owned portfolio fixtures.<br>- Models whole-share trades and preserves remaining value as `CRD_CASH`. |
| [`src/services/joinUrls.ts`](./src/services/joinUrls.ts) | Joins service URL parts without relying on slash placement. |
| [`src/services/wiremockService.ts`](./src/services/wiremockService.ts) | - Owns fixed WireMock Admin API routes.<br>- Verifies mock health.<br>- Fetches mappings for CRD-owned filtering.<br>- Resets mappings to the static file-backed baseline before a run.<br>- Finds dynamic mappings by readable metadata labels.<br>- Creates, updates, or removes mappings. |
| [`wiremock/__files/portfolioService/README.md`](./wiremock/__files/portfolioService/README.md) | Documents the static portfolio-service fixture layout and the current `accounts[]` uniqueness assumption. |
| [`src/support/setup.ts`](./src/support/setup.ts) | Applies the configured step timeout during runtime setup. |
| [`src/support/hooks.ts`](./src/support/hooks.ts) | - Uses named lifecycle hooks with focused helper functions.<br>- Verifies WireMock health before the run.<br>- Resets prior mappings to the static file-backed baseline before the run.<br>- Attaches parsed response JSON when a scenario fails.<br>- Retains dynamic mappings afterward for debugging. |
| [`src/support/logger.ts`](./src/support/logger.ts) | - Keeps embedded output aligned with Gherkin.<br>- Supports grey info, yellow warning, and red error messages. |
| [`src/support/world.ts`](./src/support/world.ts) | - Provides the scenario-scoped handshake between Cucumber and product-facing code.<br>- Carries environment config, staged input, response diagnostics, and scenario-owned WireMock mapping IDs. |

The mocked CRD product endpoints are:

| Endpoint | Purpose |
| --- | --- |
| `GET /accounts` | Lists the portfolio account names. |
| `GET /accounts/{accountId}` | Returns the asset metadata and securities for one account. |

## Static Checks

```powershell
bun run lint
bun run build
```

- `lint` runs ESLint followed by `gplint`. The Gherkin linter validates
  feature-file structure and formatting without calling the mock service.
- `build` runs `tsc --noEmit` to type-check the TypeScript code without
  generating JavaScript output.

## Test Run

Run the test suite locally:

1. Start WireMock:

   ```powershell
   bun run mock:start
   ```

2. In another terminal, run the local API scenarios:

   ```powershell
   bun run test
   ```

   The npm equivalents are:

   ```powershell
   npm run test
   npm run test:local
   ```

   Both npm scripts currently run `run-tests.ps1 -TestEnv local`. The explicit
   `test:local` alias makes the selected environment clear and leaves room for
   additional environment scripts later.

3. Select the feature scope:

   - Press Enter when prompted to run all features.
   - Run a selected feature directly by token or path:

   ```powershell
   .\run-tests.ps1 -TestEnv local crd-account-portfolio-setup
   .\run-tests.ps1 -TestEnv local features/crd-account-portfolio-setup.feature
   .\run-tests.ps1 -TestEnv local crd-accounts
   ```

4. Stop WireMock:

   ```powershell
   bun run mock:stop
   ```

## Test Results

Each test run generates:

| Type | File | Purpose |
| --- | --- | --- |
| JUnit XML result | `results/xml/api-cucumber-result.xml` | Machine-readable result for CI or test tooling. |
| Allure result data | `results/allure-results/*.json` | Raw execution data consumed by Allure Report. |
| Allure HTML report | `reports/allure-report/index.html` | Formatted single-file interactive report generated from the Allure result data. |

- The generated `results/` and `reports/` directories are excluded from Git.
- Allure Report uses the same Java runtime required by WireMock.

Generate and open the formatted Allure report:

```powershell
bun run reports
```

Run the individual report steps when needed:

```powershell
bun run reports:generate
bun run reports:open
```

Clear generated results and reports:

```powershell
bun run reports:clear
```

Clear previous artifacts and start a fresh local test run:

```powershell
bun run reports:clear; bun run test:local
```
