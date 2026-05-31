# Portfolio Rebalancing QA Solution Overview

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

- A negative target variance means the account is underweight and must buy.
- A positive target variance means the account is overweight and must sell.
- The vested asset value is `total assets * vested percentage`.
- The required trade value is `abs(target variance / 100) * vested asset value`.
- The number of shares is `trade value / unit price`.
- Fractional shares are allowed unless the application contract says otherwise.
- A zero target variance produces no trade.

## Expected Baseline Output

| Security | Target Variance | Unit Price | Required Action | Expected Shares |
| --- | ---: | ---: | --- | ---: |
| IBM | -10% | $150 | Buy | 66.6667 |
| MSFT | 0% | $90 | No trade | 0 |
| ORCL | 10% | $220 | Sell | 45.4545 |
| AAPL | 0% | $450 | No trade | 0 |
| HD | 0% | $70 | No trade | 0 |

## Six-Step Delivery Plan

### 1. Capture Requirements And Assumptions

- Document the rebalancing formula, sign convention, vested-assets rule, and
  fractional-share assumption.
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
- Make the base URL and endpoint path configurable for local execution.

### 4. Automate Portfolio Input Validation

- Use Cucumber feature scenarios and TypeScript step definitions.
- Verify WireMock availability before each scenario.
- Fetch account `ABC` and validate the portfolio securities input table.

### 5. Automate Rebalancing Output Validation

- Exercise or model the application output for buy, sell, and no-trade cases.
- Assert the total number of shares for every security.
- Allow the balance assertion table to show either the calculated columns only
  or the full securities contract.
- Add focused scenarios for rounding behavior and invalid inputs once the
  application contract is confirmed.

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
| CRD portfolio service | Complete | A typed product service owns a readable endpoint tree, portfolio endpoint calls, dynamic fixture definitions, payload validation, and modeled balance calculations. |
| Portfolio input validation | Complete | The static `GET` fixture scenario validates the supplied securities data. The dynamic setup scenario posts a scenario-owned mocked `GET` mapping through the WireMock Admin API. |
| Manual test cases | Pending | Add the interview-ready manual coverage matrix. |
| Rebalancing output validation | Complete | The dynamic account scenario models and validates buy, sell, and no-trade shares rounded to four decimals. |

## PR Review Checklist

- [x] Requirements and assumptions are documented.
- [ ] Manual test cases are included.
- [x] WireMock starts locally and serves the account fixture.
- [x] Cucumber validates the supplied portfolio input.
- [x] Automated checks validate buy, sell, and no-trade share outputs.
- [x] ESLint, Gherkin lint, TypeScript compilation, and the local Cucumber suite pass.
