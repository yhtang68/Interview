Feature: Verify the WireMock portfolio account data
    As a QA engineer,
    To validate the mocked portfolio response
    The mock should return the expected securities data table

    Scenario: Static portfolio mock returns the expected securities data
        Given GET portfolio account "abc" has the securities:
            | Security | Target % | Current % | Target Variance | Unit Price |
            | IBM      | 20       | 10        | -10             | 150        |
            | MSFT     | 20       | 20        | 0               | 90         |
            | ORCL     | 20       | 30        | 10              | 220        |
            | AAPL     | 20       | 20        | 0               | 450        |
            | HD       | 20       | 20        | 0               | 70         |

    Scenario: Dynamic portfolio mock balances the securities data
        Given POST portfolio account "abc-1" has the securities:
            | Security | Target % | Current % | Target Variance | Unit Price |
            | IBM      | 20       | 10        | -10             | 150        |
            | MSFT     | 20       | 20        | 0               | 90         |
            | ORCL     | 20       | 30        | 10              | 220        |
            | AAPL     | 20       | 20        | 0               | 450        |
            | HD       | 20       | 20        | 0               | 70         |
        Then portfolio account "abc-1" has the securities balanced:
            | Security | Action   | Shares  |
            | IBM      | Buy      | 66.6667 |
            | MSFT     | No trade | 0       |
            | ORCL     | Sell     | 45.4545 |
            | AAPL     | No trade | 0       |
            | HD       | No trade | 0       |
