Feature: Reject invalid CRD account portfolio responses
    As a QA engineer,
    To diagnose invalid portfolio responses,
    I can report malformed payloads and dependency failures

    Scenario: Malformed account portfolio response is rejected
        Given account "abc-invalid" portfolio has a malformed response
        When GET account "abc-invalid" portfolio
        Then the account portfolio response is rejected as malformed

    Scenario: Account portfolio dependency failure is reported
        Given account "abc-error" portfolio responds with a dependency failure
        When GET account "abc-error" portfolio
        Then the account portfolio dependency failure is reported
