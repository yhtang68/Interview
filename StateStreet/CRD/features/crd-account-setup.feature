Feature: Set up CRD portfolio account test data
    As a QA engineer,
    To test portfolio account behavior with reliable account fixtures,
    I can create, revise, and verify mocked CRD portfolio account data

    Scenario: Existing portfolio account data can be verified
        # Implementation detail: Static portfolio mock returns the expected securities data
        Given POST account system reset
        And GET portfolio account "abc" has the securities:
            | Security | Target % | Current % | Current Value | Target Variance % | Unit Price |
            | IBM      | 20       | 10        | 10000         | -10               | 150        |
            | MSFT     | 20       | 20        | 20000         | 0                 | 90         |
            | ORCL     | 20       | 30        | 30000         | 10                | 220        |
            | AAPL     | 20       | 20        | 20000         | 0                 | 450        |
            | HD       | 20       | 20        | 20000         | 0                 | 70         |
        Then GET portfolio account "abc" has asset:
            | Total Asset | Vested % | Cash % | Stocks % |
            | $100000     | 100      | 0      | 100      |

    Scenario: Portfolio account can be created from securities and asset data
        # Implementation detail: Dynamic portfolio mock merges account data in either order
        Given POST portfolio account "abc-2" has the securities:
            | Security | Target % | Current % | Current Value | Target Variance % | Unit Price |
            | IBM      | 50       | 40        | 4000          | -10               | 100        |
            | MSFT     | 50       | 60        | 6000          | 10                | 200        |
        And POST portfolio account "abc-2" has asset:
            | Total Asset | Vested % | Cash % | Stocks % |
            | $10000      | 100      | 0      | 100      |
        Then GET portfolio account "abc-2" has the securities:
            | Security | Target % | Current % | Current Value | Target Variance % | Unit Price |
            | IBM      | 50       | 40        | 4000          | -10               | 100        |
            | MSFT     | 50       | 60        | 6000          | 10                | 200        |
        And GET portfolio account "abc-2" has asset:
            | Total Asset | Vested % | Cash % | Stocks % |
            | $10000      | 100      | 0      | 100      |

    Scenario: Portfolio account can be revised from asset and securities data
        # Implementation detail: Existing dynamic portfolio mock is revised through mapping metadata
        Given POST portfolio account "abc-2" has asset:
            | Total Asset | Vested % | Cash % | Stocks % |
            | $20000      | 100      | 0      | 100      |
        And POST portfolio account "abc-2" has the securities:
            | Security | Target % | Current % | Current Value | Target Variance % | Unit Price |
            | IBM      | 50       | 25        | 5000          | -25               | 100        |
            | MSFT     | 50       | 75        | 15000         | 25                | 200        |
        Then GET portfolio account "abc-2" has the securities:
            | Security | Target % | Current % | Current Value | Target Variance % | Unit Price |
            | IBM      | 50       | 25        | 5000          | -25               | 100        |
            | MSFT     | 50       | 75        | 15000         | 25                | 200        |
        And GET portfolio account "abc-2" has asset:
            | Total Asset | Vested % | Cash % | Stocks % |
            | $20000      | 100      | 0      | 100      |

    Scenario: Portfolio account can be revised from securities and asset data
        # Implementation detail: Existing dynamic portfolio mock is revised in either order
        Given POST portfolio account "abc-2" has the securities:
            | Security | Target % | Current % | Current Value | Target Variance % | Unit Price |
            | IBM      | 50       | 20        | 6000          | -30               | 100        |
            | MSFT     | 50       | 80        | 24000         | 30                | 200        |
        And POST portfolio account "abc-2" has asset:
            | Total Asset | Vested % | Cash % | Stocks % |
            | $30000      | 100      | 0      | 100      |
        Then GET portfolio account "abc-2" has the securities:
            | Security | Target % | Current % | Current Value | Target Variance % | Unit Price |
            | IBM      | 50       | 20        | 6000          | -30               | 100        |
            | MSFT     | 50       | 80        | 24000         | 30                | 200        |
        And GET portfolio account "abc-2" has asset:
            | Total Asset | Vested % | Cash % | Stocks % |
            | $30000      | 100      | 0      | 100      |
        And GET accounts has:
            | Account |
            | ABC     |
            | ABC-2   |

