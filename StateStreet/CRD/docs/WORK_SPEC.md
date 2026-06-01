# Portfolio Rebalancing QA Solution Overview

> **Last updated:** June 1, 2026 5:32 PM EDT

This document is the source of truth for the proposed solution, assumptions,
delivery plan, and current implementation state.

`README.md` remains the test architecture and execution guide. The Gherkin
feature files remain the self-documented source for scenario behavior.

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
| **Balanced** | - **Action:** A portfolio is balanced by applying an action to each security.<br>- **Current %:** The percentage of **Total Asset** in dollars currently allocated to a security.<br>- **Current Value:** `[Current Value] = [Total Asset] * [Current %]`<br>- **Target %:** The **Asset** percentage targeted after balancing.<br>- **Target Variance %:** `[Target Variance %] = [Current %] - [Target %]`<br>- **Shares:** Decimal shares are not accepted because rounding can silently lose portfolio value.<br>- **Balance Flow:**<br>&nbsp;&nbsp;- **Overweight Stock:** Sell whole shares and move the executed trade value into **CRD_CASH**. Any unsellable remainder stays in the stock.<br>&nbsp;&nbsp;- **Underweight Stock:** Buy whole shares using **CRD_CASH**. Any unspent remainder stays in **CRD_CASH**.<br>- **Asset Cache:** The service refreshes the **Asset** metadata cache after balancing. |
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
- Match the static `ABC` portfolio fixture explicitly so an account without a
  portfolio returns `404` instead of matching a missing file-backed response.
- Reset prior mappings to the static file-backed baseline before each test run
  through the WireMock Admin API.
- Retain scenario-owned dynamic mappings after the run for debugging.
- Label scenario-owned mappings with readable metadata and update an existing
  account mapping when a later given republishes the same account.
- Publish the account-name collection at `/accounts` and refresh it when a
  dynamic account fixture is added.
- Allow the mock contract to publish an account name without an individual
  portfolio fixture. This intentionally represents an incomplete account setup
  state for focused testing.
- Clear static and dynamic account mappings through the CRD account service
  when an empty account collection is required.
- Remove individual account endpoints when clearing the collection so hidden
  account fixtures cannot remain reachable by ID.
- Reset the CRD account system to restore the static file-backed account
  baseline after account collection changes.
- Keep account collection listing, clearing, and reset scenarios in a
  dedicated `crd-accounts.feature` file.
- Update scenario-owned mappings after derived asset-metadata refreshes and
  rebalancing.
- Make the base URL and endpoint path configurable for local execution.

### 4. Automate Portfolio Input Validation

- Use Cucumber feature scenarios and TypeScript step definitions.
- Verify WireMock availability before each test run.
- Fetch account `ABC` and validate the portfolio securities input table.
- Preserve the account-supplied total asset value and validate each security
  current value against its allocation percentage.
- Stage dynamic account metadata and securities by account so either setup
  order merges into one validated portfolio fixture.
- Revise an existing dynamic account through the same setup flow. WireMock
  metadata identifies the account mapping so the validated fixture replaces
  the prior response without creating a duplicate.
- Preserve vested percentage as a separate account-level input.
- Cache the derived cash and stocks percentages at the account level.
- Treat total asset as authoritative account metadata. Do not derive it from
  `Unit Price` or reverse-engineer it from trade orders.

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
| Cucumber infrastructure | Complete | Shared config, local environment profile, runtime timeout setup, thin step definitions organized by product behavior, named lifecycle hooks with focused helpers, colored console output, JUnit XML results, Allure result data and reports, and TypeScript World are in place. |
| WireMock contract | Complete | Static account `ABC` data remains readable for debugging. A typed WireMock service fetches mappings for CRD-owned filtering, resets mappings to the file-backed baseline before each run, finds scenario-owned dynamic mappings by readable metadata labels, updates repeated account mappings, and retains published dynamic mappings afterward for debugging. |
| CRD portfolio service | Complete | A typed product service owns a readable endpoint tree, portfolio endpoint calls, account-name collection listing, clearing, and reset, dynamic fixture definitions, authoritative total-asset metadata, current-value validation, payload validation, whole-share balancing, and `CRD_CASH` handling. Clearing accounts removes the collection and individual account endpoints. Reset restores the static file-backed baseline. |
| Portfolio input validation | Complete | The static `GET` fixture scenario validates supplied securities and asset metadata. Dynamic setup stages asset metadata and securities by account, merges them in either order, and validates their current-value allocations before publishing the fixture. Existing dynamic accounts follow the same flow and are revised through WireMock mapping metadata. |
| Manual test cases | Pending | Add the interview-ready manual coverage matrix. |
| Rebalancing output validation | Complete | A dedicated balance feature validates buy, sell, no-trade, whole-share truncation, mapping updates, final holdings, asset metadata, and the `CRD_CASH` remainder. |

## PR Review Checklist

- [x] Requirements and assumptions are documented.
- [ ] Manual test cases are included.
- [x] WireMock starts locally and serves the account fixture.
- [x] Cucumber validates the supplied portfolio input.
- [x] Automated checks validate buy, sell, and no-trade share outputs.
- [x] ESLint, Gherkin lint, TypeScript compilation, and the local Cucumber suite pass.
