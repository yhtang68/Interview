Feature: Balance CRD account portfolio edge cases
    As a QA engineer,
    To validate portfolio rebalancing boundaries,
    I can verify cash, rounding, large-value, and vested behavior

    Scenario: Account portfolio with insufficient cash cannot be balanced
        Given POST account "abc-insufficient-cash" portfolio has asset:
            | Total Asset | Vested % | Cash % | Stocks % |
            | $1000       | 100      | 0      | 100      |
        And POST account "abc-insufficient-cash" portfolio has the securities:
            | Security | Target % | Current % | Current Value | Target Variance % | Unit Price |
            | IBM      | 100      | 0         | 0             | -100              | 100        |
            | MSFT     | 0        | 100       | 1000          | 100               | 2000       |

        When POST account "abc-insufficient-cash" portfolio balanced
        Then the account portfolio insufficient cash error is reported

    Scenario: Account portfolio preserves whole-share rounding remainder
        Given POST account "abc-rounding" portfolio has asset:
            | Total Asset | Vested % | Cash % | Stocks % |
            | $1000       | 100      | 0      | 100      |
        And POST account "abc-rounding" portfolio has the securities:
            | Security | Target % | Current % | Current Value | Target Variance % | Unit Price |
            | IBM      | 50       | 0         | 0             | -50               | 300        |
            | MSFT     | 50       | 100       | 1000          | 50                | 100        |

        When POST account "abc-rounding" portfolio has the securities balanced:
            | Security | Action | Shares | Unit Price |
            | IBM      | Buy    | 1      | 300        |
            | MSFT     | Sell   | 5      | 100        |
        Then GET account "abc-rounding" portfolio has the securities:
            | Security | Current Value |
            | IBM      | 300           |
            | MSFT     | 500           |
            | CRD_CASH | 200           |

    Scenario: Stock below its unit price cannot be sold
        Given POST account "abc-unsellable-remainder" portfolio has asset:
            | Total Asset | Vested % | Cash % | Stocks % |
            | $50         | 100      | 0      | 100      |
        And POST account "abc-unsellable-remainder" portfolio has the securities:
            | Security | Target % | Current % | Current Value | Target Variance % | Unit Price |
            | MSFT     | 0        | 100       | 50            | 100               | 100        |

        When POST account "abc-unsellable-remainder" portfolio has the securities balanced:
            | Security | Action   | Shares | Unit Price |
            | MSFT     | No trade | 0      | 100        |
        Then GET account "abc-unsellable-remainder" portfolio has the securities:
            | Security | Current Value |
            | MSFT     | 50            |

    Scenario: Large-value account portfolio can be balanced
        Given POST account "abc-large" portfolio has asset:
            | Total Asset   | Vested % | Cash % | Stocks % |
            | $100000000000 | 100      | 0      | 100      |
        And POST account "abc-large" portfolio has the securities:
            | Security | Target % | Current % | Current Value | Target Variance % | Unit Price |
            | IBM      | 50       | 0         | 0             | -50               | 0.01       |
            | MSFT     | 50       | 100       | 100000000000  | 50                | 0.01       |

        When POST account "abc-large" portfolio has the securities balanced:
            | Security | Action | Shares        | Unit Price |
            | IBM      | Buy    | 5000000000000 | 0.01       |
            | MSFT     | Sell   | 5000000000000 | 0.01       |
        Then GET account "abc-large" portfolio has the securities:
            | Security | Current Value |
            | IBM      | 50000000000   |
            | MSFT     | 50000000000   |

    Scenario: Partially vested account portfolio can be balanced
        Given POST account "abc-partial-vesting" portfolio has asset:
            | Total Asset | Vested % | Cash % | Stocks % |
            | $10000      | 50       | 0      | 100      |
        And POST account "abc-partial-vesting" portfolio has the securities:
            | Security | Target % | Current % | Current Value | Target Variance % | Unit Price |
            | IBM      | 50       | 40        | 4000          | -10               | 100        |
            | MSFT     | 50       | 60        | 6000          | 10                | 100        |

        When POST account "abc-partial-vesting" portfolio has the securities balanced:
            | Security | Action | Shares | Unit Price |
            | IBM      | Buy    | 5      | 100        |
            | MSFT     | Sell   | 5      | 100        |
        Then GET account "abc-partial-vesting" portfolio has the securities:
            | Security | Current % | Current Value | Target Variance % |
            | IBM      | 45        | 4500          | -5                |
            | MSFT     | 55        | 5500          | 5                 |
