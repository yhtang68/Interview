Feature: Manage a CRD account portfolio
    As a QA engineer,
    To validate one account portfolio independently from the accounts collection,
    I can verify portfolio retrieval, validation, and failure behavior

    # Backlog: implement these scenarios one at a time.
    # Accounts[] collection behavior remains in crd-accounts.feature.

    @pending
    Scenario: Account portfolio test backlog is documented

    #
    # Scenario: Account portfolio can be retrieved
    #     Given an account portfolio exists for "abc"
    #     When GET account portfolio "abc"
    #     Then the account portfolio is returned
    #
    # Scenario: Account can exist without a portfolio
    #     Given account "abc-empty" exists without a portfolio
    #     When GET account portfolio "abc-empty"
    #     Then the account portfolio is missing
    #
    # Scenario: Missing account portfolio is reported
    #     Given account portfolio "abc-missing" does not exist
    #     When GET account portfolio "abc-missing"
    #     Then the account portfolio is missing
    #
    # Scenario: Malformed account portfolio response is rejected
    #     Given account portfolio "abc-invalid" has a malformed response
    #     When GET account portfolio "abc-invalid"
    #     Then the account portfolio response is rejected as malformed
    #
    # Scenario: Account portfolio dependency failure is reported
    #     Given account portfolio "abc-error" responds with a dependency failure
    #     When GET account portfolio "abc-error"
    #     Then the account portfolio dependency failure is reported
    #
    # Scenario: Empty account portfolio can be retrieved
    #     Given account portfolio "abc-empty-holdings" has no securities
    #     When GET account portfolio "abc-empty-holdings"
    #     Then the empty account portfolio is returned
    #
    # Scenario: Zero-value account portfolio can be retrieved
    #     Given account portfolio "abc-zero" has zero total asset
    #     When GET account portfolio "abc-zero"
    #     Then the zero-value account portfolio is returned
    #
    # Scenario: Account portfolio with insufficient cash cannot be balanced
    #     Given account portfolio "abc-insufficient-cash" requires more cash than available
    #     When POST account portfolio "abc-insufficient-cash" balanced
    #     Then the account portfolio insufficient cash error is reported
    #
    # Scenario: Account portfolio preserves whole-share rounding remainder
    #     Given account portfolio "abc-rounding" requires fractional shares
    #     When POST account portfolio "abc-rounding" balanced
    #     Then the account portfolio preserves the rounding remainder as cash
    #
    # Scenario: Large-value account portfolio can be balanced
    #     Given account portfolio "abc-large" has large asset values
    #     When POST account portfolio "abc-large" balanced
    #     Then the account portfolio large-value trades are returned
    #
    # Contract clarification required before implementation:
    # define how vested percentage limits available trading value.
    #
    # Scenario: Partially vested account portfolio can be balanced
    #     Given account portfolio "abc-partial-vesting" is partially vested
    #     When POST account portfolio "abc-partial-vesting" balanced
    #     Then the account portfolio trades respect the vested percentage
