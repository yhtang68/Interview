# Portfolio Rebalancing QA Solution Overview

> **Last updated:** June 1, 2026 12:28 AM EDT

This document is the source of truth for the proposed solution, assumptions,
delivery plan, and current implementation state.

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
| **Asset** | - A portfolio of **Security** holdings valued in dollars.<br>- Scaled by **Balanced** processing.<br>- **Total Asset** is the total dollar value of **Security** in the book, including **CRD_CASH**.<br>- **Vested %** is the account-level percentage available for rebalancing trades.<br>&nbsp;&nbsp;For example, `$1,000` in total assets and `80%` vested means `$800` is available for trading. |
| **Balanced** | - **Action:** A portfolio is balanced by applying an action to each security.<br>- **Current %:** The percentage of **Total Asset** in dollars currently allocated to a security.<br>- **Current Value:** `[Current Value] = [Total Asset] * [Current %]`<br>- **Target %:** The **Asset** percentage targeted after balancing.<br>- **Target Variance %:** `[Target Variance %] = [Current %] - [Target %]`<br>- **Shares:** Decimal shares are not accepted because rounding can silently lose portfolio value.<br>- **Remainder:** Trade by the **Shares** rule. Keep the remainder in **CRD_CASH** to avoid losing money.<br>- **Asset Cache:** The service refreshes the **Asset** metadata cache after balancing. |
| **Security** | - A **Portfolio** contains two security types: **Stock** and **Cash**.<br>- **Stock** represents a tradable market security.<br>- **Cash** is represented by **CRD_CASH**.<br>&nbsp;&nbsp;It preserves unallocated value with a `$1` unit price, so the complete account value remains visible and auditable.<br>- **Balanced Action** by **Shares** rule.<br>- Do not use **Unit Price** to reverse-engineer existing shares. |

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
   - A zero `[Trade Value]` requires **No Trade**.

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
   - `[Trade Value] = $20,000 - $10,000 = $10,000`

2. Convert the required change into an executable order:
   - `[Whole Shares] = truncate($10,000 / $150) = 66`
   - Apply a **Buy** action.

3. Apply the order and preserve the remainder:
   - `[Updated Current Value] = $10,000 + (66 * $150) = $19,900`
   - Consume available cash or **Sell** proceeds for the **Buy** action.
     - The supplied example does not include **CRD_CASH** to consume yet.
   - Keep the `$100` residual target gap visible.

## Six-Step Delivery Plan

### 1. Capture Requirements And Assumptions

- Document the rebalancing formula, sign convention, vested-assets rule,
  whole-share execution rule, and `CRD_CASH` remainder handling.
- Confirm the trade-math flow before automating assertions.

### 2. Define Manual Test Coverage

- Cover the supplied account `ABC` happy path.
- Cover zero variance, underweight buy, overweight sell, fractional shares,
  invalid account, malformed data, unavailable dependency, and boundary cases.
- Record expected results clearly enough for interview discussion.

### 3. Build The Local Mock Contract

- Provide a WireMock endpoint for account portfolio data.
- Keep the mapping and JSON fixture readable and deterministic.
- Register and remove scenario-owned dynamic mappings through the WireMock
  Admin API.
- Update scenario-owned mappings after asset-cache refreshes and rebalancing.
- Make the base URL and endpoint path configurable for local execution.

### 4. Automate Portfolio Input Validation

- Use Cucumber feature scenarios and TypeScript step definitions.
- Verify WireMock availability before each scenario.
- Fetch account `ABC` and validate the portfolio securities input table.
- Calculate total assets from security current values.
- Preserve vested percentage as a separate account-level input.
- Cache the derived cash and stocks percentages at the account level.
- Treat cached account asset values as optional: validate them when present and
  log a warning when a fixture should be patched.

### 5. Automate Rebalancing Output Validation

- Exercise or model the application output for buy, sell, and no-trade cases.
- Assert the whole-share trade count for every security.
- Preserve any remaining value as the `CRD_CASH` security.
- Allow the balance assertion table to show either the calculated columns only
  or the full securities contract.
- Keep account-level vested percentage visible in scenario data so
  partial-vesting behavior can be defined when the product contract is clear.
- Add focused scenarios for whole-share remainder behavior and invalid inputs
  once the application contract is confirmed.

### 6. Verify Delivery And Review Readiness

- Run `bun run lint`.
- Run `bun run build`.
- Start WireMock with `bun run mock:start`.
- Run the local Cucumber suite with `.\run-tests.ps1 -TestEnv local`.
- Review the PR against this spec and call out any unimplemented items,
  assumptions, and residual risks.

## Current State

| Area | Status | Notes |
| --- | --- | --- |
| Requirements and assumptions | Complete | Trade-math decisions are documented above. |
| Cucumber infrastructure | Complete | Shared config, local environment profile, runtime timeout setup, thin step definitions, named lifecycle hooks with focused helpers, colored console output, JUnit XML results, Allure result data and reports, and TypeScript World are in place. |
| WireMock contract | Complete | Static account `ABC` data remains readable for debugging. A typed WireMock service owns fixed Admin API routes and registers or removes scenario-owned dynamic mappings. |
| CRD portfolio service | Complete | A typed product service owns a readable endpoint tree, portfolio endpoint calls, dynamic fixture definitions, current-value asset calculations, payload validation, whole-share balancing, and `CRD_CASH` handling. |
| Portfolio input validation | Complete | The static `GET` fixture scenario validates supplied securities and calculated assets. The dynamic setup scenario posts a scenario-owned mocked `GET` mapping through the WireMock Admin API and verifies its asset cache. |
| Manual test cases | Pending | Add the interview-ready manual coverage matrix. |
| Rebalancing output validation | Complete | The dynamic account scenario validates buy, sell, no-trade, whole-share truncation, mapping updates, final holdings, asset cache, and the `CRD_CASH` remainder. |

## PR Review Checklist

- [x] Requirements and assumptions are documented.
- [ ] Manual test cases are included.
- [x] WireMock starts locally and serves the account fixture.
- [x] Cucumber validates the supplied portfolio input.
- [x] Automated checks validate buy, sell, and no-trade share outputs.
- [x] ESLint, Gherkin lint, TypeScript compilation, and the local Cucumber suite pass.
