Feature: Verify the WireMock portfolio account data
    As a QA engineer,
    To validate the mocked portfolio response
    The mock should return the expected portfolio account data

    Scenario: Static portfolio mock returns the expected securities data
        Given GET portfolio account "abc" has the securities:
            | Security | Target % | Current % | Current Value | Target Variance % | Unit Price |
            | IBM      | 20       | 10        | 10000         | -10               | 150        |
            | MSFT     | 20       | 20        | 20000         | 0                 | 90         |
            | ORCL     | 20       | 30        | 30000         | 10                | 220        |
            | AAPL     | 20       | 20        | 20000         | 0                 | 450        |
            | HD       | 20       | 20        | 20000         | 0                 | 70         |
        Then GET portfolio account "abc" has asset:
            | Total Asset | Vested % | Cash % | Stocks % |
            | $100000     | 100      | 0      | 100      |

    Scenario: Dynamic portfolio mock balances the securities data
        Given POST portfolio account "abc-1" has the securities:
            | Security | Target % | Current % | Current Value | Target Variance % | Unit Price |
            | IBM      | 20       | 15        | 15000         | -5                | 300        |
            | MSFT     | 20       | 25        | 25000         | 5                 | 100        |
            | ORCL     | 20       | 20        | 20000         | 0                 | 250        |
            | AAPL     | 20       | 10        | 10000         | -10               | 500        |
            | HD       | 20       | 30        | 30000         | 10                | 50         |
        And POST portfolio account "abc-1" has asset:
            | Total Asset | Vested % | Cash % | Stocks % |
            | $100000     | 100      | 0      | 100      |
        When POST portfolio account "abc-1" has the securities balanced:
            | Security | Action   | Shares | Unit Price |
            | IBM      | Buy      | 16     | 300        |
            | MSFT     | Sell     | 50     | 100        |
            | ORCL     | No trade | 0      | 250        |
            | AAPL     | Buy      | 20     | 500        |
            | HD       | Sell     | 200    | 50         |
        Then GET portfolio account "abc-1" has the securities:
            | Security | Target % | Current % | Current Value | Target Variance % | Unit Price |
            | IBM      | 20       | 19.8      | 19800         | -0.2              | 300        |
            | MSFT     | 20       | 20        | 20000         | 0                 | 100        |
            | ORCL     | 20       | 20        | 20000         | 0                 | 250        |
            | AAPL     | 20       | 20        | 20000         | 0                 | 500        |
            | HD       | 20       | 20        | 20000         | 0                 | 50         |
            | CRD_CASH | 0        | 0.2       | 200           | 0.2               | 1          |
        And GET portfolio account "abc-1" has asset:
            | Total Asset | Vested % | Cash % | Stocks % |
            | $100000     | 100      | 0.2    | 99.8     |
