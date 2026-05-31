Feature: Verify the WireMock portfolio account data
    As a QA engineer,
    To validate the mocked portfolio response
    The mock should return the expected securities data table

    Scenario: Portfolio mock returns the expected securities data
        Given mock is up
        Then GET portfolio account "abc" returns the securities data table:
            | Security | Target % | Current % | Target Variance | Unit Price |
            | IBM      | 20       | 10        | -10             | 150        |
            | MSFT     | 20       | 20        | 0               | 90         |
            | ORCL     | 20       | 30        | 10              | 220        |
            | AAPL     | 20       | 20        | 0               | 450        |
            | HD       | 20       | 20        | 0               | 70         |
