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
