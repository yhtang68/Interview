# CRD Account Portfolio Backlog

Implemented scenarios move into dedicated `crd-account-portfolio-<category>.feature`
files.

## Retrieval And Failure Behavior

- [ ] Account portfolio can be retrieved.
- [ ] Account can exist without a portfolio.
- [ ] Missing account portfolio is reported.
- [ ] Malformed account portfolio response is rejected.
- [ ] Account portfolio dependency failure is reported.
- [ ] Empty account portfolio can be retrieved.
- [ ] Zero-value account portfolio can be retrieved.

## Balancing Edges

- [ ] Account portfolio with insufficient cash cannot be balanced.
- [ ] Account portfolio preserves whole-share rounding remainder.
- [ ] Large-value account portfolio can be balanced.
- [ ] Partially vested account portfolio can be balanced.

The partially vested scenario requires contract clarification: define how
vested percentage limits available trading value.
