Feature: Manage CRD portfolio accounts
    As a QA engineer,
    To manage reliable portfolio account fixtures,
    I can list and clear mocked CRD portfolio accounts

    Scenario: Portfolio accounts can be listed
        # Implementation detail: The mocked account collection includes the static portfolio account
        Then GET accounts has:
            | Account |
            | ABC     |

    Scenario: Portfolio accounts can be deleted
        # Implementation detail: Clearing accounts removes static and dynamic portfolio account mappings
        When POST clear accounts
        Then GET accounts is empty

    Scenario: Portfolio account system can be reset
        # Implementation detail: Resetting mappings restores the static file-backed account baseline
        When POST account system reset
        Then GET accounts has:
            | Account |
            | ABC     |

    Scenario: Portfolio account can be listed without a portfolio
        # Implementation detail: The account-name collection and individual portfolio mappings are separate resources
        Given POST account system reset
        When POST account "abc-empty"
        Then GET accounts has:
            | Account   |
            | ABC       |
            | ABC-EMPTY |
        And GET portfolio account "abc-empty" is missing

    Scenario: Portfolio account can have a portfolio
        # Implementation detail: The static baseline publishes the account name and individual portfolio mapping together
        Given POST account system reset
        Then GET accounts has:
            | Account |
            | ABC     |
        And GET portfolio account "abc" exists
