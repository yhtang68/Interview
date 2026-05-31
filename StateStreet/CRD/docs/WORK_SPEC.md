# Portfolio Rebalancing QA Solution Overview

> **Last updated:** May 31, 2026 5:51 PM EDT

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
report the correct number of shares to buy or sell for each security to reach
zero target variance.

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
| **Action** | The proposed rebalancing instruction for a security: **Buy**, **Sell**, or **No Trade**. |
| **Action - Buy** | Purchase the calculated number of whole **Shares** because the security is below its **Target %**. |
| **Action - No Trade** | Do not place an order because the security is already at its **Target %**. |
| **Action - Sell** | Sell the calculated number of whole **Shares** because the security is above its **Target %**. |
| **Asset Value** | Use **Current Value** as each security's current asset value. For example, IBM has `$10,000` in current value. Do not use its `$150` **Unit Price**, which is the acceptable target trading price, to reverse-engineer `66.6667` existing shares. |
| **Asset Value - Metadata** | - The account-level asset view contains `Total Asset`, `Vested %`, `Cash %`, and `Stocks %`.<br>- The service stores these values as a cache to reduce repeated calculations.<br>- Securities remain the source of truth, and the cache is updated by **Balanced** processing. |
| **Balanced** | - A portfolio is balanced when each security reaches its **Target %** as closely as whole-share execution allows.<br>- Any unavoidable remainder is preserved as `CRD_CASH`, so a small residual target variance remains visible instead of being silently discarded, to avoid losing value over time.<br>- The service refreshes the **Asset Value - Metadata** cache after balancing. |
| **Cash %** | The percentage of total account assets held as `CRD_CASH`. It is derived from the securities data and stored in the account asset cache. |
| **CRD_CASH** | Unallocated value is preserved as `CRD_CASH`, with a unit price of `$1`, so the complete account value remains visible and auditable. |
| **Current %** | The percentage of total account assets currently allocated to a security. |
| **Current Value** | Portfolio securities use allocation values as the source of truth: `current value = current percentage * total asset`. |
| **Security** | A portfolio holding or cash position included in the rebalance calculation. |
| **Shares** | The whole-share quantity proposed for a **Buy** or **Sell** action. |
| **Static Existing Shares** | `Unit Price` must not be used to infer the static account's existing share count. The original assignment does not provide that holding detail. |
| **Stocks %** | The percentage of total account assets held as securities other than `CRD_CASH`. It is derived from the securities data and stored in the account asset cache. |
| **Target %** | The desired percentage of total account assets allocated to a security after rebalancing. |
| **Target Variance - Negative** | The account is underweight and must buy. |
| **Target Variance - Positive** | The account is overweight and must sell. |
| **Target Variance - Zero** | No trade is required. |
| **Total Asset** | The complete account value, calculated as the sum of all security current values, including `CRD_CASH`. |
| **Unit Price** | This is the acceptable target trading price for the new buy or sell order. It will usually be the latest observed market price when rebalancing starts. It is used to calculate the proposed trade quantity, but it does not describe the historical cost of shares already owned. |
| **Vested %** | This account-level percentage is supplied by the product contract and cannot be derived from security holdings alone. It means the percentage of total account assets available for rebalancing trades. For example, an account with `$100,000` in total assets and `80%` vested has `$80,000` available for trading. |
| **Whole-Share Execution** | Decimal share quantities are not accepted because rounding can silently lose portfolio value. A fractional calculated trade is truncated toward zero. |

## Expected Baseline Output

The assignment baseline below shows the theoretical fractional-share
calculation before execution constraints are applied. Executed trades must use
whole shares. The automated dynamic scenario verifies that any remainder is
preserved as `CRD_CASH`.

| Security | Target Variance | Unit Price | Required Action | Expected Shares |
| --- | ---: | ---: | --- | ---: |
| IBM | -10% | $150 | Buy | 66.6667 |
| MSFT | 0% | $90 | No trade | 0 |
| ORCL | 10% | $220 | Sell | 45.4545 |
| AAPL | 0% | $450 | No trade | 0 |
| HD | 0% | $70 | No trade | 0 |

## Six-Step Delivery Plan

### 1. Capture Requirements And Assumptions

- Document the rebalancing formula, sign convention, vested-assets rule,
  whole-share execution rule, and `CRD_CASH` remainder handling.
- Confirm the expected baseline output before automating assertions.

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
| Requirements and assumptions | Complete | Baseline calculations are documented above. |
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
