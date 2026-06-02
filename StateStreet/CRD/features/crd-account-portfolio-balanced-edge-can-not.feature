Feature: Balance CRD account portfolio edge cases that cannot be balanced
    As a QA engineer,
    To validate portfolio rebalancing boundaries,
    I can verify cash and unsellable edge behavior that cannot be balanced

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
