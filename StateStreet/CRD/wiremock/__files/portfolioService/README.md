# Portfolio Service Fixtures

The fixture layout mirrors the portfolio service API routes:

| Fixture | API route | Purpose |
| --- | --- | --- |
| `accounts.json` | `GET /accounts` | Returns the account-name collection. |
| `accounts/<id>.json` | `GET /accounts/<id>` | Returns one account portfolio object. |

## Accounts Collection

The current `accounts[]` collection contains normalized account names, such as `ABC`.
Names are uppercased, deduplicated, and sorted. The mock therefore treats the
normalized account name as unique and does not represent separate accounts with
the same display name.

For example, `accounts/abc.json` is the response body for `GET /accounts/abc`.

## Account Portfolio Identity

Each `Account{}` portfolio object stores an `account_id` and an `account_name`.
For dynamically registered mock portfolios, the setup step takes the account ID
from the route argument, such as `abc-2`, and currently derives the account name
by uppercasing that ID, producing `ABC-2`.

This is a mock simplification. It does not currently support a distinct display
name such as `My Retirement Account` for an account with ID `abc-2`.
