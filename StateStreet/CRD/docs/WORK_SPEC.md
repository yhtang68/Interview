# Portfolio Rebalancing QA Solution Overview

> **Last updated:** June 2, 2026 8:32 PM EDT

This document is the source of truth for the proposed solution, assumptions,
delivery plan, and current implementation state.

[`README.md`](../README.md) remains the test architecture and execution guide.
The [Gherkin feature files](../features) remain the self-documented source for
scenario behavior.

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

### 1. Action

1. **Buy / Sell** whole **Shares** of the security to meet the **Target %**.
2. **No Trade** when the security is already at its **Target %**.
3. **Shares** are calculated as whole shares in [Trade Math](#trade-math).

### 2. Asset

1. A portfolio of **Security** holdings valued in dollars.
2. Scaled by **Balanced** processing.
3. **Total Asset** is authoritative account metadata. It is the total dollar
   value of **Security** in the book, including **CRD_CASH**.
4. **Vested %** is the account-level percentage available for rebalancing
   trades.
   - For example, `$1,000` in total assets and `80%` vested means `$800` is
     available for trading.

### 3. Balanced

1. **Action:** A portfolio is balanced by applying an action to each security.
2. **Current %:** The percentage of **Total Asset** in dollars currently
   allocated to a security.
3. **Current Value:** `[Current Value] = [Total Asset] * [Current %]`
4. **Target %:** The **Asset** percentage targeted after balancing.
5. **Target Variance %:** `[Target Variance %] = [Current %] - [Target %]`
6. **Whole Shares:** Truncate `[Trade Value] / [Unit Price]` into an integer
   share count to avoid silently losing portfolio value.
7. **Decimal:** Use decimal arithmetic for money, prices, and percentages.
8. **Vested:** Multiply each desired trade value by **Vested %** before
   truncating to whole shares.
9. **Remainder:** Preserve unexecuted trade value as **CRD_CASH** so
    whole-share rounding does not lose account value over time.
10. **Safe Integer:** Keep the integer share count within JavaScript's
    safe-integer range.
11. **Large Values:** For example, `$100 billion / $0.01 = 10 trillion` shares,
    which remains below the safe-integer limit.
12. **Trade Order:** Process **Sell** actions before **Buy** actions. Within
    each action, process stocks from the highest **Unit Price** to the lowest.
13. **Overweight Stock:** Sell whole shares and move the executed trade value
    into **CRD_CASH**. Any unsellable remainder stays in the stock.
14. **Underweight Stock:** Buy whole shares using **CRD_CASH**. Any unspent
    remainder stays in **CRD_CASH**.
15. **Asset Cache:** The service refreshes the **Asset** metadata cache after
    balancing.

### 4. Security

1. A **Portfolio** contains two security types: **Stock** and **Cash**.
2. **Stock** represents a tradable market security.
3. **Cash** is represented by **CRD_CASH**. It preserves unallocated value with
   a `$1` unit price, so the complete account value remains visible and
   auditable.
4. Rebalancing applies the **[Action](#1-action)** rules to each **Security**.
5. **Unit Price** is the agreed trade price used by **Balanced** processing.
6. Do not use **Unit Price** to reverse-engineer existing shares.

## Trade Math

The **Balanced** calculation applies each security's **Target %** in three
steps:

1. Calculate `[Target Value]` and `[Trade Value]`:
   1. `[Target Value] = [Total Asset] * [Target %]`
   2. `[Trade Value] = [Target Value] - [Current Value]`

2. Convert the required change into an executable order:
   1. `[Whole Shares] = truncate(abs([Trade Value]) / [Unit Price])`
   2. A positive `[Trade Value]` requires **Buy**.
   3. A negative `[Trade Value]` requires **Sell**.
   4. A zero `[Trade Value]`, or fewer than one executable share, requires **No Trade**.

3. Apply the order and preserve the remainder:
   1. `[Updated Current Value] = [Current Value] +/- ([Whole Shares] * [Unit Price])`
   2. **Buy** actions consume available **CRD_CASH**, while **Sell** actions
     replenish it.
   3. Store any remaining value as **CRD_CASH** to avoid losing money through
     repeated whole-share rounding, then refresh the **Asset** metadata cache.

For example, the IBM security in
[North American - Technical Assessment QA.md](./North%20American%20-%20Technical%20Assessment%20QA.md)
follows the steps defined above.

1. Calculate `[Target Value]` and `[Trade Value]`:
   1. `[Target Value] = $100,000 * 20% = $20,000`
   2. `[Current Value] = $100,000 * 10% = $10,000`
   3. `[Trade Value] = $20,000 - $10,000 = $10,000`

2. Convert the required change into an executable order:
   1. `[Whole Shares] = truncate($10,000 / $150) = 66`
   2. IBM requires a **Buy** action.

3. Apply the order and preserve the remainder:
   1. `[Updated Current Value] = $10,000 + (66 * $150) = $19,900`
   2. Consume available cash or **Sell** proceeds for the **Buy** action.
   3. The supplied example does not include **CRD_CASH** to consume yet.
   4. When cash is available, keep the unspent `$100` in **CRD_CASH**.

## Six-Step Delivery Plan

### 1. Capture Requirements And Assumptions

- Detailed in [Assumptions](#assumptions) and [Trade Math](#trade-math).

### 2. Define Test Coverage

1. **Automation First:** The current API surface is expected to be fully
   automatable through the Cucumber and WireMock infrastructure. Separate
   manual execution is not planned; the readable Gherkin scenarios remain the
   human-reviewable test-case record.
2. **Baseline:** Cover the supplied account `ABC` happy path.
3. **Edge Cases:** Cover zero variance, underweight buy, overweight sell,
   fractional shares, invalid account, malformed data, unavailable dependency,
   and boundary cases.
4. **Non-Functional Notes:** See [PRS.test.md](../features/PRS.test.md).
5. **Review Ready:** Use Gherkin BDD and Allure Report to make interview
   discussion easier.

### 3. Build The Local Mock Contract

#### 3.1 WireMock

1. **Configurable URLs:** For example, configure local URLs in
   `config/env/local.api.conf.js`.
2. **Debuggable State:** Retain scenario-owned dynamic mappings after the test
   run for debugging.
3. **Deterministic Baseline:** Reset mappings to static file-backed before each
   test run.
4. **Readable Fixtures:** Keep `wiremock/mappings` and `wiremock/__files`
   readable and deterministic.

#### 3.2 Accounts[]

1. **Features:** Keep `Accounts[]` collection scenarios in dedicated
   [`crd-accounts*.feature`](../features) files.

#### 3.3 Account {} - Portfolio

1. **DELETE Portfolio:** Deleting an account from `Accounts[]` also removes its
   `Account {}` portfolio.
2. **GET Portfolio:** Match the static `ABC` portfolio fixture explicitly.
   - For example, `GET http://localhost:9999/accounts/abc-empty` returns `404`
     when `ABC-EMPTY` exists in `Accounts[]` but has no `Account {}` portfolio.
3. **Features:** Keep `Account {}` portfolio scenarios in dedicated
   [`crd-account-portfolio*.feature`](../features) files.
4. **Mock Endpoint:** A WireMock endpoint, for example
   `GET http://localhost:9999/accounts/abc`.

### 4. Automate Portfolio Input Validation

#### 4.1 WireMock

1. **Mock Health:** For example, `GET http://localhost:9999/__admin/health`.

#### 4.2 Account {} - Portfolio Input

1. **Authoritative Asset:** See
   `wiremock/__files/portfolioService/accounts/abc.json`.
2. **Derived Cache:** For example,
   `{ "cash_percentage": 0.2, "stocks_percentage": 99.8 }`.
3. **Flexible Setup Order:** Support `POST securities` then `POST asset`, or
   `POST asset` then `POST securities`.
4. **No Reverse Engineering:** Do not derive `total_asset` from `unit_price`.
5. **Vested Input:** For example, `{ "vested": 0.8 }`.

#### 4.3 Cucumber

1. **Readable Automation:** See [`features/*.feature`](../features) and
   [`src/step_definitions/*.ts`](../src/step_definitions).

### 5. Automate Rebalancing Output Validation

#### 5.1 Account {} - Portfolio Output

1. **Vested Visibility:** For example, `{ "vested": 0.8 }`.
2. **Visible Remainder:** See
   [`features/crd-account-portfolio-balanced.feature`](../features/crd-account-portfolio-balanced.feature).

#### 5.2 Security {} - Trade Validation

1. **Flexible Assertions:** See
   [`features/crd-account-portfolio-balanced.feature`](../features/crd-account-portfolio-balanced.feature).
2. **Trade Actions:** For example,
   `{ "security": "IBM", "action": "Buy", "shares": 16 }`.
3. **Whole Shares:** For example, `{ "security": "IBM", "shares": 16 }`.

#### 5.3 Test Coverage

1. **Focused Edges:** See
   [`features/crd-account-portfolio-balanced-edge*.feature`](../features).

### 6. Verify Delivery And Review Readiness

1. **Lint:** Run `bun run lint`.
2. **Build:** Run `bun run build`.
3. **Start Mock:** Start WireMock with `bun run mock:start`.
4. **Run Tests:** Run the local Cucumber suite with
   `.\run-tests.ps1 -TestEnv local`.
5. **Review Risks:** Review the PR against this spec and call out any
   unimplemented items, assumptions, and residual risks.

## Current State

### 1. Requirements And Assumptions

- **Status:** Complete
- Trade-math decisions are documented above.

### 2. Cucumber Infrastructure

- **Status:** Complete
- Shared config, local environment profile, runtime timeout setup, thin step
  definitions organized by product behavior, named lifecycle hooks with focused
  helpers, colored console output, JUnit XML results, Allure result data and
  reports, and TypeScript World are in place.

### 3. WireMock Contract

- **Status:** Complete
- Static account `ABC` data remains readable for debugging. A typed WireMock
  service fetches mappings for CRD-owned filtering, resets mappings to the
  file-backed baseline before each run, finds scenario-owned dynamic mappings by
  readable metadata labels, updates repeated account mappings, and retains
  published dynamic mappings afterward for debugging.

### 4. CRD Portfolio Service

- **Status:** Complete
- A typed product service owns a readable endpoint tree, portfolio endpoint
  calls, account-name collection listing, clearing, reset, and dynamic fixture
  definitions. Clearing accounts removes the collection and individual account
  endpoints. Reset restores the static file-backed baseline.

### 5. CRD Portfolio Model

- **Status:** Complete
- A separate typed model owns payload validation, authoritative total-asset
  metadata, current-value validation, whole-share balancing, and `CRD_CASH`
  handling.

### 6. Portfolio Input Validation

- **Status:** Complete
- The static `GET` fixture scenario validates supplied securities and asset
  metadata. Dynamic setup stages asset metadata and securities by account,
  merges them in either order, and validates their current-value allocations
  before publishing the fixture. Existing dynamic accounts follow the same flow
  and are revised through WireMock mapping metadata.

### 7. Accounts Collection Validation

- **Status:** Complete
- Dedicated [`crd-accounts*.feature`](../features) files validate `Accounts[]` listing,
  registration, normalization, deduplication, clearing, deletion, reset, and
  idempotency behavior.

### 8. Account Portfolio Validation

- **Status:** Complete
- Dedicated [`crd-account-portfolio-*.feature`](../features) files validate setup, revision,
  deletion, reset, successful retrieval, missing portfolios, malformed
  responses, dependency failures, empty portfolios, and zero-value portfolios.

### 9. Rebalancing Output Validation

- **Status:** Complete
- The dedicated balance features validate buy, sell, no-trade, trade order,
  whole-share truncation, mapping updates, final holdings, asset metadata,
  `CRD_CASH` remainder, insufficient cash, large values, and partial vesting.

### 10. Non-Functional Coverage Notes

- **Status:** Complete
- [`features/PRS.test.md`](../features/PRS.test.md) captures PRS and Security
  ideas for the API service.

## PR Review Checklist

1. [x] Requirements and assumptions are documented.
2. [x] Implemented test cases are captured as readable, executable Cucumber scenarios.
3. [x] Remaining `Account{}` portfolio backlog scenarios are implemented.
4. [x] WireMock starts locally and serves the account fixture.
5. [x] Cucumber validates the supplied portfolio input.
6. [x] Automated checks validate buy, sell, and no-trade share outputs.
7. [x] ESLint, Gherkin lint, TypeScript compilation, and the local Cucumber suite pass.
