# Portfolio Rebalancing QA Solution Overview

> **Last updated:** June 2, 2026 11:33 AM EDT

This document is the source of truth for the proposed solution, assumptions,
delivery plan, and current implementation state.

`README.md` remains the test architecture and execution guide. The Gherkin
feature files remain the self-documented source for scenario behavior.

## Table Of Contents

- [Assignment Reference](#assignment-reference)
- [Assessment Goal](#assessment-goal)
- [Solution Overview](#solution-overview)
- [Assumptions](#assumptions)
- [Trade Math](#trade-math)
- [Six-Step Delivery Plan](#six-step-delivery-plan)
- [Current State](#current-state)
- [PR Review Checklist](#pr-review-checklist)

## Assignment Reference

The original assignment is available in:

- [North American - Technical Assessment QA.md](./North%20American%20-%20Technical%20Assessment%20QA.md)
- [North American - Technical Assessment QA.docx](./North%20American%20-%20Technical%20Assessment%20QA.docx)
- [North American - Technical Assessment QA.pdf](./North%20American%20-%20Technical%20Assessment%20QA.pdf)

## Assessment Goal

Test a portfolio rebalancing application for account `ABC`, which has
`$100,000` in total assets and is `100%` vested. The application output must
report the correct number of shares to buy or sell for each security to
approach zero target variance under whole-share execution.

## Solution Overview

The automated QA solution uses Cucumber.js scenarios backed by thin TypeScript
step definitions. A CRD portfolio service owns the product contract, mocked
endpoint calls, and rebalancing model. A separate WireMock service owns Admin
API operations for static fixture checks and scenario-owned dynamic mappings.

The configuration is split into shared Cucumber settings and environment
profiles. This keeps local URLs outside the shared runner config and allows
future environments to reuse the same test suite. The local profile states
explicitly that WireMock currently serves the CRD portfolio product URL.

## Assumptions

| Term | Decision |
| --- | --- |
| **Action** | - **Buy / Sell** whole **Shares** of the security to meet the **Target %**.<br>- **No Trade** when the security is already at its **Target %**. |
| **Asset** | - A portfolio of **Security** holdings valued in dollars.<br>- Scaled by **Balanced** processing.<br>- **Total Asset** is authoritative account metadata. It is the total dollar value of **Security** in the book, including **CRD_CASH**.<br>- **Vested %** is the account-level percentage available for rebalancing trades.<br>&nbsp;&nbsp;For example, `$1,000` in total assets and `80%` vested means `$800` is available for trading. |
| **Balanced** | - **Action:** A portfolio is balanced by applying an action to each security.<br>- **Current %:** The percentage of **Total Asset** in dollars currently allocated to a security.<br>- **Current Value:** `[Current Value] = [Total Asset] * [Current %]`<br>- **Target %:** The **Asset** percentage targeted after balancing.<br>- **Target Variance %:** `[Target Variance %] = [Current %] - [Target %]`<br>- **Shares:** Decimal shares are not accepted because rounding can silently lose portfolio value.<br>&nbsp;&nbsp;- Use decimal arithmetic for money, prices, and percentages.<br>&nbsp;&nbsp;- Multiply each desired trade value by **Vested %** before truncating to whole shares.<br>&nbsp;&nbsp;- Truncate `[Trade Value] / [Unit Price]` into an integer share count.<br>&nbsp;&nbsp;- Keep the integer share count within JavaScript's safe-integer range.<br>&nbsp;&nbsp;- For example, `$100 billion / $0.01 = 10 trillion` shares, which remains below the safe-integer limit.<br>- **Balance Flow:**<br>&nbsp;&nbsp;- **Trade Order:** Process **Sell** actions before **Buy** actions. Within each action, process stocks from the highest **Unit Price** to the lowest.<br>&nbsp;&nbsp;- **Overweight Stock:** Sell whole shares and move the executed trade value into **CRD_CASH**. Any unsellable remainder stays in the stock.<br>&nbsp;&nbsp;- **Underweight Stock:** Buy whole shares using **CRD_CASH**. Any unspent remainder stays in **CRD_CASH**.<br>- **Asset Cache:** The service refreshes the **Asset** metadata cache after balancing. |
| **Security** | - A **Portfolio** contains two security types: **Stock** and **Cash**.<br>- **Stock** represents a tradable market security.<br>- **Cash** is represented by **CRD_CASH**.<br>&nbsp;&nbsp;It preserves unallocated value with a `$1` unit price, so the complete account value remains visible and auditable.<br>- **Balanced Action** by **Shares** rule.<br>- **Unit Price** is the agreed trade price used by **Balanced** processing.<br>&nbsp;&nbsp;- Do not use **Unit Price** to reverse-engineer existing shares. |

## Trade Math

The **Balanced** calculation applies each security's **Target %** in three
steps:

1. Calculate `[Target Value]` and `[Trade Value]`:
   - `[Target Value] = [Total Asset] * [Target %]`
   - `[Trade Value] = [Target Value] - [Current Value]`

2. Convert the required change into an executable order:
   - `[Whole Shares] = truncate(abs([Trade Value]) / [Unit Price])`
   - A positive `[Trade Value]` requires **Buy**.
   - A negative `[Trade Value]` requires **Sell**.
   - A zero `[Trade Value]`, or fewer than one executable share, requires **No Trade**.

3. Apply the order and preserve the remainder:
   - `[Updated Current Value] = [Current Value] +/- ([Whole Shares] * [Unit Price])`
   - **Buy** actions consume available **CRD_CASH**, while **Sell** actions
     replenish it.
   - Store any remaining value as **CRD_CASH**, then refresh the **Asset**
     metadata cache.

For example, the IBM security in
[North American - Technical Assessment QA.md](./North%20American%20-%20Technical%20Assessment%20QA.md)
follows the steps defined above.

1. Calculate `[Target Value]` and `[Trade Value]`:
   - `[Target Value] = $100,000 * 20% = $20,000`
   - `[Current Value] = $100,000 * 10% = $10,000`
   - `[Trade Value] = $20,000 - $10,000 = $10,000`

2. Convert the required change into an executable order:
   - `[Whole Shares] = truncate($10,000 / $150) = 66`
   - IBM requires a **Buy** action.

3. Apply the order and preserve the remainder:
   - `[Updated Current Value] = $10,000 + (66 * $150) = $19,900`
   - Consume available cash or **Sell** proceeds for the **Buy** action.
     - The supplied example does not include **CRD_CASH** to consume yet.
   - When cash is available, keep the unspent `$100` in **CRD_CASH**.

## Six-Step Delivery Plan

### 1. Capture Requirements And Assumptions

- **Explicit Rules:** See [Assumptions](#assumptions) and
  [Trade Math](#trade-math).
- **Validated Math:** See [Trade Math](#trade-math).

### 2. Define Test Coverage

- **Automation First:** The current API surface is expected to be fully automatable through the
  Cucumber and WireMock infrastructure. Separate manual execution is not
  planned; the readable Gherkin scenarios remain the human-reviewable test-case
  record.
- **Baseline:** Cover the supplied account `ABC` happy path.
- **Edge Cases:** Cover zero variance, underweight buy, overweight sell, fractional shares,
  invalid account, malformed data, unavailable dependency, and boundary cases.
- **Review Ready:** Use Gherkin BDD and Allure Report to make interview
  discussion easier.

### 3. Build The Local Mock Contract

#### **- WireMock -**

| Rule | Requirement |
| --- | --- |
| **Configurable URLs** | For example, configure local URLs in `config/env/local.api.conf.js`. |
| **Debuggable State** | Retain scenario-owned dynamic mappings after the test run for debugging. |
| **Deterministic Baseline** | Reset mappings to static file-backed before each test run. |
| **Readable Fixtures** | Keep `wiremock/mappings` and `wiremock/__files` readable and deterministic. |

#### **- Accounts[] -**

| Rule | Requirement |
| --- | --- |
| **Features** | Keep `Accounts[]` collection scenarios in dedicated `crd-accounts*.feature` files. |

#### **- Account {} - Portfolio -**

| Rule | Requirement |
| --- | --- |
| **DELETE Portfolio** | Deleting an account from `Accounts[]` also removes its `Account {}` portfolio. |
| **GET Portfolio** | Match the static `ABC` portfolio fixture explicitly.<br>For example, `GET http://localhost:9999/accounts/abc-empty` returns `404` when `ABC-EMPTY` exists in `Accounts[]` but has no `Account {}` portfolio. |
| **Features** | Keep `Account {}` portfolio scenarios in dedicated `crd-account-portfolio*.feature` files. |
| **Mock Endpoint** | A WireMock endpoint, for example `GET http://localhost:9999/accounts/abc`. |

### 4. Automate Portfolio Input Validation

#### **- WireMock -**

| Rule | Requirement |
| --- | --- |
| **Mock Health** | For example, `GET http://localhost:9999/__admin/health`. |

#### **- Account {} - Portfolio Input -**

| Rule | Requirement |
| --- | --- |
| **Authoritative Asset** | See `wiremock/__files/portfolioService/accounts/abc.json`. |
| **Derived Cache** | For example, `{ "cash_percentage": 0.2, "stocks_percentage": 99.8 }`. |
| **Flexible Setup Order** | Support `POST securities` then `POST asset`, or `POST asset` then `POST securities`. |
| **No Reverse Engineering** | Do not derive `total_asset` from `unit_price`. |
| **Vested Input** | For example, `{ "vested": 0.8 }`. |

#### **- Cucumber -**

| Rule | Requirement |
| --- | --- |
| **Readable Automation** | See `features/*.feature` and `src/step_definitions/*.ts`. |

### 5. Automate Rebalancing Output Validation

#### **- Account {} - Portfolio Output -**

| Rule | Requirement |
| --- | --- |
| **Vested Visibility** | For example, `{ "vested": 0.8 }`. |
| **Visible Remainder** | See `features/crd-account-portfolio-balanced.feature`. |

#### **- Security {} - Trade Validation -**

| Rule | Requirement |
| --- | --- |
| **Flexible Assertions** | See `features/crd-account-portfolio-balanced.feature`. |
| **Trade Actions** | For example, `{ "security": "IBM", "action": "Buy", "shares": 16 }`. |
| **Whole Shares** | For example, `{ "security": "IBM", "shares": 16 }`. |

#### **- Test Coverage -**

| Rule | Requirement |
| --- | --- |
| **Focused Edges** | See `features/crd-account-portfolio-backlog.md`. |

### 6. Verify Delivery And Review Readiness

- **Lint:** Run `bun run lint`.
- **Build:** Run `bun run build`.
- **Start Mock:** Start WireMock with `bun run mock:start`.
- **Run Tests:** Run the local Cucumber suite with `.\run-tests.ps1 -TestEnv local`.
- **Review Risks:** Review the PR against this spec and call out any unimplemented items,
  assumptions, and residual risks.

## Current State

| Area | Status | Notes |
| --- | --- | --- |
| Requirements and assumptions | Complete | Trade-math decisions are documented above. |
| Cucumber infrastructure | Complete | Shared config, local environment profile, runtime timeout setup, thin step definitions organized by product behavior, named lifecycle hooks with focused helpers, colored console output, JUnit XML results, Allure result data and reports, and TypeScript World are in place. |
| WireMock contract | Complete | Static account `ABC` data remains readable for debugging. A typed WireMock service fetches mappings for CRD-owned filtering, resets mappings to the file-backed baseline before each run, finds scenario-owned dynamic mappings by readable metadata labels, updates repeated account mappings, and retains published dynamic mappings afterward for debugging. |
| CRD portfolio service | Complete | A typed product service owns a readable endpoint tree, portfolio endpoint calls, account-name collection listing, clearing, reset, and dynamic fixture definitions. Clearing accounts removes the collection and individual account endpoints. Reset restores the static file-backed baseline. |
| CRD portfolio model | Complete | A separate typed model owns payload validation, authoritative total-asset metadata, current-value validation, whole-share balancing, and `CRD_CASH` handling. |
| Portfolio input validation | Complete | The static `GET` fixture scenario validates supplied securities and asset metadata. Dynamic setup stages asset metadata and securities by account, merges them in either order, and validates their current-value allocations before publishing the fixture. Existing dynamic accounts follow the same flow and are revised through WireMock mapping metadata. |
| Accounts collection validation | Complete | Dedicated `crd-accounts*.feature` files validate `Accounts[]` listing, registration, normalization, deduplication, clearing, deletion, reset, and idempotency behavior. |
| Account portfolio validation | Complete | Dedicated `crd-account-portfolio-*.feature` files validate setup, revision, deletion, reset, successful retrieval, missing portfolios, malformed responses, dependency failures, empty portfolios, and zero-value portfolios. |
| Rebalancing output validation | Complete | The dedicated balance features validate buy, sell, no-trade, trade order, whole-share truncation, mapping updates, final holdings, asset metadata, `CRD_CASH` remainder, insufficient cash, large values, and partial vesting. |

## PR Review Checklist

- [x] Requirements and assumptions are documented.
- [x] Implemented test cases are captured as readable, executable Cucumber scenarios.
- [x] Remaining `Account{}` portfolio backlog scenarios are implemented.
- [x] WireMock starts locally and serves the account fixture.
- [x] Cucumber validates the supplied portfolio input.
- [x] Automated checks validate buy, sell, and no-trade share outputs.
- [x] ESLint, Gherkin lint, TypeScript compilation, and the local Cucumber suite pass.
