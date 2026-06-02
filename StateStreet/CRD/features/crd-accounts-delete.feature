Feature: Delete CRD accounts
    As a QA engineer,
    To maintain reliable account fixtures,
    I can delete mocked CRD accounts

    # Accounts represents the Accounts[] collection of account identifiers.

    Scenario: A last remaining account can be deleted
        Given POST account system reset

        When DELETE account "abc"
        Then GET accounts is empty

    Scenario: A specific account can be deleted
        Given POST account system reset
        And POST accounts:
            | Account |
            | abc-1   |
            | abc-2   |

        When DELETE account "abc-1"
        Then GET accounts is:
            | Account |
            | ABC     |
            | ABC-2   |

    Scenario: Deleting a specific account is idempotent
        Given POST account system reset
        And POST accounts:
            | Account |
            | abc-1   |
            | abc-2   |
        And DELETE account "abc-1"

        When DELETE account "abc-1"
        Then GET accounts is:
            | Account |
            | ABC     |
            | ABC-2   |
