Feature: Add a CRD account portfolio
    As a QA engineer,
    To keep the accounts collection aligned with portfolio fixtures,
    I can add a portfolio and register its account

    Scenario: Adding a portfolio also adds its account
        Given POST account system reset
        And POST account "abc-1" portfolio has asset:
            | Total Asset | Vested % | Cash % | Stocks % |
            | $10000      | 100      | 0      | 100      |
        And POST account "abc-1" portfolio has the securities:
            | Security | Target % | Current % | Current Value | Target Variance % | Unit Price |
            | IBM      | 100      | 100       | 10000         | 0                 | 100        |

        Then GET accounts is:
            | Account |
            | ABC     |
            | ABC-1   |
