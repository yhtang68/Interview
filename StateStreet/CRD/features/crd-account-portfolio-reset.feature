Feature: Reset CRD account portfolios
    As a QA engineer,
    To restore reliable portfolio fixtures,
    I can reset mocked CRD account portfolios

    Scenario: Account portfolio system can be reset
        When POST account system reset
        Then GET account "abc" portfolio has identity:
            | Account ID | Account Name |
            | abc        | ABC          |

    Scenario: Account portfolio system reset is idempotent
        Given POST account system reset

        When POST account system reset
        Then GET account "abc" portfolio has identity:
            | Account ID | Account Name |
            | abc        | ABC          |

    Scenario: Account portfolio system reset removes dynamic portfolios
        Given POST account system reset
        And POST account "abc-1" portfolio has asset:
            | Total Asset | Vested % | Cash % | Stocks % |
            | $10000      | 100      | 0      | 100      |
        And POST account "abc-1" portfolio has the securities:
            | Security | Target % | Current % | Current Value | Target Variance % | Unit Price |
            | IBM      | 100      | 100       | 10000         | 0                 | 100        |

        When POST account system reset
        Then GET account "abc-1" portfolio is missing

    Scenario: Account portfolio system reset restores deleted default portfolio
        Given POST account system reset
        And DELETE account "abc" portfolio

        When POST account system reset
        Then GET account "abc" portfolio has identity:
            | Account ID | Account Name |
            | abc        | ABC          |
