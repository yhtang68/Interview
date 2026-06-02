Feature: Get a CRD account portfolio successfully
    As a QA engineer,
    To inspect portfolio fixtures,
    I can retrieve an account portfolio or confirm that it is missing

    Scenario: Account portfolio can be retrieved
        Given POST account system reset
        Then GET account "abc" portfolio has identity:
            | Account ID | Account Name |
            | abc        | ABC          |

    Scenario: Account can exist without a portfolio
        Given POST account system reset
        And POST accounts:
            | Account   |
            | abc-empty |
        Then GET account "abc-empty" portfolio is missing

    Scenario: Missing account portfolio is reported
        Given POST account system reset
        Then GET account "abc-missing" portfolio is missing

    Scenario: Empty account portfolio can be retrieved
        Given POST account "abc-empty" portfolio has asset:
            | Total Asset | Vested % | Cash % | Stocks % |
            | $0          | 100      | 0      | 0        |
        And POST account "abc-empty" portfolio has the securities:
            | Security | Target % | Current % | Current Value | Target Variance % | Unit Price |
        Then GET account "abc-empty" portfolio has the securities:
            | Security | Target % | Current % | Current Value | Target Variance % | Unit Price |

    Scenario: Zero-value account portfolio can be retrieved
        Given POST account "abc-zero" portfolio has asset:
            | Total Asset | Vested % | Cash % | Stocks % |
            | $0          | 100      | 0      | 0        |
        And POST account "abc-zero" portfolio has the securities:
            | Security | Target % | Current % | Current Value | Target Variance % | Unit Price |
            | IBM      | 0        | 0         | 0             | 0                 | 100        |
        Then GET account "abc-zero" portfolio has the securities:
            | Security | Current Value |
            | IBM      | 0             |
