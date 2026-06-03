# PRS Test Notes

PRS testing is a non-functional software testing methodology that stands for
**Performance**, **Reliability**, and **Scalability**.

These notes define PRS coverage ideas for the CRD portfolio rebalancing QA
project.

## Scope

1. **Performance:** Validate API response time for account portfolio retrieval
   and rebalance calculations under expected async load.
2. **Reliability:** Validate stable API behavior across repeated resets,
   dynamic fixture updates, async requests, and edge-case rebalance attempts.
3. **Scalability:** Validate behavior as portfolio count, security count,
   concurrent request count, and account volume increase.

## Candidate Checks

1. **Performance:**
   1. Measure GET account portfolio latency for small vs large portfolios.
   2. Measure async API response latency under concurrent GET account portfolio
      requests.
2. **Reliability:**
   1. Repeat account reset and portfolio reset flows to detect drift or flaky
      state.
   2. Run edge-case rebalance scenarios repeatedly to confirm deterministic
      errors and no-trade outcomes.
   3. Run repeated async API requests and confirm responses remain consistent.
3. **Scalability:**
   1. Measure rebalance behavior as portfolios grow to many securities.
   2. Measure API behavior as concurrent request volume increases.

## Security Checks

Security testing is a separate non-functional concern focused on protecting API
access, input handling, and sensitive portfolio data.

1. **Authentication:** Confirm unauthenticated account portfolio requests are
   rejected.
2. **Authorization:** Confirm one account cannot access or modify another
   account portfolio without permission.
3. **Input Validation:** Confirm malformed account IDs, invalid percentages, and
   invalid security values are rejected safely.
4. **Data Protection:** Confirm responses do not expose unnecessary sensitive
   account or portfolio data.
5. **Abuse Resistance:** Confirm repeated async requests are rate-limited or
   handled without service degradation.

## Status

Initial PRS test note file added for future updates.
