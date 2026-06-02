# PRS Test Notes

PRS testing is a non-functional software testing methodology that stands for
**Performance**, **Reliability**, and **Scalability**.

These notes define PRS coverage ideas for the CRD portfolio rebalancing QA
project.

## Scope

| Scope | Focus |
| --- | --- |
| **Performance** | Validate API response time for account portfolio retrieval and rebalance calculations under expected async load. |
| **Reliability** | Validate stable API behavior across repeated resets, dynamic fixture updates, async requests, and edge-case rebalance attempts. |
| **Scalability** | Validate behavior as portfolio count, security count, concurrent request count, and account volume increase. |

## Candidate Checks

| Scope | Candidate Check |
| --- | --- |
| **Performance** | Measure GET account portfolio latency for small vs large portfolios. |
| **Performance** | Measure async API response latency under concurrent GET account portfolio requests. |
| **Scalability** | Measure rebalance behavior as portfolios grow to many securities. |
| **Scalability** | Measure API behavior as concurrent request volume increases. |
| **Reliability** | Repeat account reset and portfolio reset flows to detect drift or flaky state. |
| **Reliability** | Run edge-case rebalance scenarios repeatedly to confirm deterministic errors and no-trade outcomes. |
| **Reliability** | Run repeated async API requests and confirm responses remain consistent. |

## Security Checks

Security testing is a separate non-functional concern focused on protecting API
access, input handling, and sensitive portfolio data.

| Area | Candidate Check |
| --- | --- |
| Authentication | Confirm unauthenticated account portfolio requests are rejected. |
| Authorization | Confirm one account cannot access or modify another account portfolio without permission. |
| Input Validation | Confirm malformed account IDs, invalid percentages, and invalid security values are rejected safely. |
| Data Protection | Confirm responses do not expose unnecessary sensitive account or portfolio data. |
| Abuse Resistance | Confirm repeated async requests are rate-limited or handled without service degradation. |

## Status

Initial PRS test note file added for future updates.
