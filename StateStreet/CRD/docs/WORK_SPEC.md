# Portfolio Rebalancing QA Solution Overview

This document is the source of truth for the proposed solution, assumptions,
delivery plan, and current implementation state.

## Assignment Reference

The original assignment is available in:

- [North American - Technical Assessment QA.md](./North%20American%20-%20Technical%20Assessment%20QA.md)
- [North American - Technical Assessment QA.docx](./North%20American%20-%20Technical%20Assessment%20QA.docx)

## Assessment Goal

Test a portfolio rebalancing application for account `ABC`, which has
`$100,000` in total assets and is `100%` vested. The application output must
report the correct number of shares to buy or sell for each security to reach
zero target variance.

## Solution Overview

The automated QA solution uses Cucumber.js scenarios backed by TypeScript step
definitions. A local WireMock endpoint supplies deterministic account data so
the test infrastructure can validate the portfolio contract before the
rebalancing-output scenarios are implemented.

The configuration is split into shared Cucumber settings and environment
profiles. This keeps local URLs outside the shared runner config and allows
future environments to reuse the same test suite.

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
- Make the base URL and endpoint path configurable for local execution.

### 4. Automate Portfolio Input Validation

- Use Cucumber feature scenarios and TypeScript step definitions.
- Verify WireMock availability before making assertions.
- Fetch account `ABC` and validate the portfolio securities input table.

### 5. Automate Rebalancing Output Validation

- Exercise or model the application output for buy, sell, and no-trade cases.
- Assert the total number of shares for every security.
- Add focused scenarios for rounding behavior and invalid inputs once the
  application contract is confirmed.

### 6. Verify Delivery And Review Readiness

- Run `bun run lint`.
- Run `bunx tsc --noEmit`.
- Start WireMock with `bun run mock:start`.
- Run the local Cucumber suite with `.\run-tests.ps1 -TestEnv local`.
- Review the PR against this spec and call out any unimplemented items,
  assumptions, and residual risks.

## Current State

| Area | Status | Notes |
| --- | --- | --- |
| Requirements and assumptions | Complete | Baseline calculations are documented above. |
| Cucumber infrastructure | Complete | Shared config, local environment profile, runtime timeout setup, failure diagnostics hook, colored console output, JUnit XML results, Allure result data and reports, and TypeScript World are in place. |
| WireMock contract | Complete | Local account `ABC` mapping and fixture are available. |
| Portfolio input validation | Complete | The current scenario validates all supplied securities data. |
| Manual test cases | Pending | Add the interview-ready manual coverage matrix. |
| Rebalancing output validation | Pending | Add scenarios and implementation for calculated buy, sell, and no-trade shares. |

## PR Review Checklist

- [x] Requirements and assumptions are documented.
- [ ] Manual test cases are included.
- [x] WireMock starts locally and serves the account fixture.
- [x] Cucumber validates the supplied portfolio input.
- [ ] Automated checks validate buy, sell, and no-trade share outputs.
- [x] ESLint, Gherkin lint, TypeScript compilation, and the local Cucumber suite pass.
