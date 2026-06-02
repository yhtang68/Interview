Feature: Manage a CRD account portfolio
    As a QA engineer,
    To validate one account portfolio independently from the accounts collection,
    I can verify portfolio retrieval, validation, and failure behavior

    # Backlog: implement these scenarios one at a time.
    # Accounts[] collection behavior remains in crd-accounts.feature.

    Scenario: Account portfolio can be deleted
        Given POST account system reset
        When DELETE account "abc" portfolio
        Then GET account "abc" portfolio is missing
        And GET accounts is:
            | Account |
            | ABC     |

    #
    # Scenario: Account portfolio can be retrieved
    #     Given account "abc" portfolio exists
    #     When GET account "abc" portfolio
    #     Then the account portfolio is returned
    #
    # Scenario: Account can exist without a portfolio
    #     Given account "abc-empty" exists without a portfolio
    #     When GET account "abc-empty" portfolio
    #     Then the account portfolio is missing
    #
    # Scenario: Missing account portfolio is reported
    #     Given account "abc-missing" portfolio does not exist
    #     When GET account "abc-missing" portfolio
    #     Then the account portfolio is missing
    #
    # Scenario: Malformed account portfolio response is rejected
    #     Given account "abc-invalid" portfolio has a malformed response
    #     When GET account "abc-invalid" portfolio
    #     Then the account portfolio response is rejected as malformed
    #
    # Scenario: Account portfolio dependency failure is reported
    #     Given account "abc-error" portfolio responds with a dependency failure
    #     When GET account "abc-error" portfolio
    #     Then the account portfolio dependency failure is reported
    #
    # Scenario: Empty account portfolio can be retrieved
    #     Given account "abc-empty-holdings" portfolio has no securities
    #     When GET account "abc-empty-holdings" portfolio
    #     Then the empty account portfolio is returned
    #
    # Scenario: Zero-value account portfolio can be retrieved
    #     Given account "abc-zero" portfolio has zero total asset
    #     When GET account "abc-zero" portfolio
    #     Then the zero-value account portfolio is returned
    #
    # Scenario: Account portfolio with insufficient cash cannot be balanced
    #     Given account "abc-insufficient-cash" portfolio requires more cash than available
    #     When POST account "abc-insufficient-cash" portfolio balanced
    #     Then the account portfolio insufficient cash error is reported
    #
    # Scenario: Account portfolio preserves whole-share rounding remainder
    #     Given account "abc-rounding" portfolio requires fractional shares
    #     When POST account "abc-rounding" portfolio balanced
    #     Then the account portfolio preserves the rounding remainder as cash
    #
    # Scenario: Large-value account portfolio can be balanced
    #     Given account "abc-large" portfolio has large asset values
    #     When POST account "abc-large" portfolio balanced
    #     Then the account portfolio large-value trades are returned
    #
    # Contract clarification required before implementation:
    # define how vested percentage limits available trading value.
    #
    # Scenario: Partially vested account portfolio can be balanced
    #     Given account "abc-partial-vesting" portfolio is partially vested
    #     When POST account "abc-partial-vesting" portfolio balanced
    #     Then the account portfolio trades respect the vested percentage
