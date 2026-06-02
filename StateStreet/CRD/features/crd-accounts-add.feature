Feature: Add CRD accounts
    As a QA engineer,
    To maintain reliable account fixtures,
    I can register mocked CRD accounts

    # Accounts represents the Accounts[] collection of account identifiers.

    Scenario: Accounts can be registered after accounts are cleared
        Given POST account system reset
        And POST clear accounts

        When POST accounts:
            | Account |
            | abc-new |
        Then GET accounts is:
            | Account |
            | ABC-NEW |

    Scenario: Accounts can be registered after accounts are cleared repeatedly
        Given POST account system reset
        And POST clear accounts
        And POST accounts:
            | Account |
            | abc-1   |
        And POST clear accounts

        When POST accounts:
            | Account |
            | abc-2   |
        Then GET accounts is:
            | Account |
            | ABC-2   |

    Scenario: Duplicate account registrations do not collide
        Given POST account system reset

        When POST accounts:
            | Account |
            | ABC     |
            | abc-1   |
            | ABC-1   |
            | abc-1   |
        Then GET accounts is:
            | Account |
            | ABC     |
            | ABC-1   |

    Scenario: Registered accounts are uppercased and sorted
        Given POST account system reset

        When POST accounts:
            | Account |
            | abc-2   |
            | abc-1   |
        Then GET accounts is:
            | Account |
            | ABC     |
            | ABC-1   |
            | ABC-2   |
