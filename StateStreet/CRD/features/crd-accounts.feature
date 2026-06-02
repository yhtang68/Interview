Feature: Manage CRD accounts
    As a QA engineer,
    To inspect and clear reliable account fixtures,
    I can list and clear mocked CRD accounts

    # Accounts represents the Accounts[] collection of account identifiers.
    # Account{} portfolio details are tested separately in crd-account-portfolio-*.feature.

    Scenario: Accounts can be cleared
        Given POST account system reset
        # [System reset] loads the default account: ABC
        And POST accounts:
            | Account |
            | abc-1   |
            | abc-2   |
        And GET accounts has:
            | Account |
            | ABC     |
            | ABC-1   |
            | ABC-2   |

        When POST clear accounts
        Then GET accounts is empty

    Scenario: Accounts can be listed
        Given POST account system reset
        # [System reset] loads the default account: ABC

        When POST accounts:
            | Account |
            | abc-1   |
            | abc-2   |
            | abc-3   |
        Then GET accounts has:
            | Account |
            | ABC     |
            | ABC-1   |
            | ABC-2   |
            | ABC-3   |

    Scenario: Clearing accounts is idempotent
        Given POST account system reset
        And POST clear accounts

        When POST clear accounts
        Then GET accounts is empty
