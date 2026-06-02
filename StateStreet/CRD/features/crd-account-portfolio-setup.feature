Feature: Set up CRD account portfolio test data
    As a QA engineer,
    To test an account portfolio with reliable fixtures,
    I can create, revise, and verify mocked CRD account portfolio data

    Scenario: Existing account portfolio data can be verified
        # Reset the default account portfolio.
        Given POST account system reset

        # Verify the default account portfolio.
        And GET account "abc" portfolio has the securities:
            | Security | Target % | Current % | Current Value | Target Variance % | Unit Price |
            | IBM      | 20       | 10        | 10000         | -10               | 150        |
            | MSFT     | 20       | 20        | 20000         | 0                 | 90         |
            | ORCL     | 20       | 30        | 30000         | 10                | 220        |
            | AAPL     | 20       | 20        | 20000         | 0                 | 450        |
            | HD       | 20       | 20        | 20000         | 0                 | 70         |
        Then GET account "abc" portfolio has identity:
            | Account ID | Account Name |
            | abc        | ABC          |
        And GET account "abc" portfolio has asset:
            | Total Asset | Vested % | Cash % | Stocks % |
            | $100000     | 100      | 0      | 100      |

    Scenario: Account portfolio can be created from securities and asset data
        # Set a new account portfolio.
        Given POST account "abc-2" portfolio has the securities:
            | Security | Target % | Current % | Current Value | Target Variance % | Unit Price |
            | IBM      | 50       | 40        | 4000          | -10               | 100        |
            | MSFT     | 50       | 60        | 6000          | 10                | 200        |
        And POST account "abc-2" portfolio has asset:
            | Total Asset | Vested % | Cash % | Stocks % |
            | $10000      | 100      | 0      | 100      |

        # Verify the new account portfolio.
        Then GET account "abc-2" portfolio has identity:
            | Account ID | Account Name |
            | abc-2      | ABC-2        |
        And GET account "abc-2" portfolio has the securities:
            | Security | Target % | Current % | Current Value | Target Variance % | Unit Price |
            | IBM      | 50       | 40        | 4000          | -10               | 100        |
            | MSFT     | 50       | 60        | 6000          | 10                | 200        |
        And GET account "abc-2" portfolio has asset:
            | Total Asset | Vested % | Cash % | Stocks % |
            | $10000      | 100      | 0      | 100      |

    Scenario: Account portfolio can be revised from asset and securities data
        # Set the initial account portfolio.
        Given POST account "abc-2" portfolio has asset:
            | Total Asset | Vested % | Cash % | Stocks % |
            | $10000      | 100      | 0      | 100      |
        And POST account "abc-2" portfolio has the securities:
            | Security | Target % | Current % | Current Value | Target Variance % | Unit Price |
            | IBM      | 50       | 40        | 4000          | -10               | 100        |
            | MSFT     | 50       | 60        | 6000          | 10                | 200        |

        # Revise the account portfolio with updated asset and securities data.
        When POST account "abc-2" portfolio has asset:
            | Total Asset | Vested % | Cash % | Stocks % |
            | $20000      | 100      | 0      | 100      |
        And POST account "abc-2" portfolio has the securities:
            | Security | Target % | Current % | Current Value | Target Variance % | Unit Price |
            | IBM      | 50       | 25        | 5000          | -25               | 100        |
            | MSFT     | 50       | 75        | 15000         | 25                | 200        |

        # Verify the revised account portfolio.
        Then GET account "abc-2" portfolio has the securities:
            | Security | Target % | Current % | Current Value | Target Variance % | Unit Price |
            | IBM      | 50       | 25        | 5000          | -25               | 100        |
            | MSFT     | 50       | 75        | 15000         | 25                | 200        |
        And GET account "abc-2" portfolio has asset:
            | Total Asset | Vested % | Cash % | Stocks % |
            | $20000      | 100      | 0      | 100      |

    Scenario: Account portfolio can be revised from securities and asset data
        # Set the initial account portfolio.
        Given POST account "abc-2" portfolio has the securities:
            | Security | Target % | Current % | Current Value | Target Variance % | Unit Price |
            | IBM      | 50       | 40        | 4000          | -10               | 100        |
            | MSFT     | 50       | 60        | 6000          | 10                | 200        |
        And POST account "abc-2" portfolio has asset:
            | Total Asset | Vested % | Cash % | Stocks % |
            | $10000      | 100      | 0      | 100      |

        # Revise the account portfolio with updated securities and asset data.
        When POST account "abc-2" portfolio has the securities:
            | Security | Target % | Current % | Current Value | Target Variance % | Unit Price |
            | IBM      | 50       | 20        | 6000          | -30               | 100        |
            | MSFT     | 50       | 80        | 24000         | 30                | 200        |
        And POST account "abc-2" portfolio has asset:
            | Total Asset | Vested % | Cash % | Stocks % |
            | $30000      | 100      | 0      | 100      |

        # Verify the revised account portfolio.
        Then GET account "abc-2" portfolio has the securities:
            | Security | Target % | Current % | Current Value | Target Variance % | Unit Price |
            | IBM      | 50       | 20        | 6000          | -30               | 100        |
            | MSFT     | 50       | 80        | 24000         | 30                | 200        |
        And GET account "abc-2" portfolio has asset:
            | Total Asset | Vested % | Cash % | Stocks % |
            | $30000      | 100      | 0      | 100      |
        And GET accounts has:
            | Account |
            | ABC     |
            | ABC-2   |
