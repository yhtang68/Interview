Feature: Delete a CRD account portfolio
    As a QA engineer,
    To maintain reliable portfolio fixtures,
    I can delete a portfolio without deleting its account

    Scenario: Deleting a portfolio keeps its account
        Given POST account system reset
        When DELETE account "abc" portfolio
        Then GET account "abc" portfolio is missing
        And GET accounts is:
            | Account |
            | ABC     |
