Feature: Reset CRD accounts
    As a QA engineer,
    To restore reliable account fixtures,
    I can reset mocked CRD accounts

    # Accounts represents the Accounts[] collection of account identifiers.

    Scenario: Account system can be reset
        When POST account system reset
        Then GET accounts has:
            | Account |
            | ABC     |

    Scenario: Account system reset is idempotent
        Given POST account system reset
        When POST account system reset
        Then GET accounts is:
            | Account |
            | ABC     |

    Scenario: Account system reset removes dynamic accounts
        Given POST account system reset
        And POST accounts:
            | Account |
            | abc-1   |
            | abc-2   |
        When POST account system reset
        Then GET accounts is:
            | Account |
            | ABC     |

    Scenario: Account system reset restores cleared default accounts
        Given POST account system reset
        And POST clear accounts
        When POST account system reset
        Then GET accounts is:
            | Account |
            | ABC     |
