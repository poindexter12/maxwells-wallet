# MCP server

Maxwell's Wallet exposes an authenticated [Model Context Protocol](https://modelcontextprotocol.io/) server for a self-hosted instance. It uses Streamable HTTP with JSON responses at `POST /mcp`. Clients authenticate with a personal API token in an `Authorization: Bearer <token>` header.

MCP is enabled by default. Disable it with `MCP_ENABLED=false` when the instance should not expose the endpoint.

## Create a token

In the web UI, open **Admin → Security** and use the **Personal API tokens** section. The raw token is shown once. A token can have `read`, `write`, or both scopes. An optional expiry is set in days; without one, it does not expire. Revoke a token from the same section.

The equivalent API calls require the normal JWT session token. Create one with `POST /api/v1/auth/tokens`:

```bash
curl -X POST https://wallet.example/api/v1/auth/tokens \
  -H "Authorization: Bearer $WALLET_JWT" \
  -H 'Content-Type: application/json' \
  -d '{"name":"Claude Code","scopes":["read","write"],"expires_in_days":90}'
```

The response contains `token` exactly once. Store it securely. List metadata without secrets with `GET /api/v1/auth/tokens`, and soft-revoke a token with:

```bash
curl -X DELETE https://wallet.example/api/v1/auth/tokens/TOKEN_ID \
  -H "Authorization: Bearer $WALLET_JWT"
```

A revoked or expired token is rejected. Read tools and classification suggestions require `read`; every mutating tool requires `write`.

## Connect a client

For Claude Code, use the token as a shell variable rather than putting it in shell history or a project file:

```bash
export MAXWELLS_WALLET_MCP_TOKEN='mw_pat_...'
claude mcp add --transport http maxwells-wallet \
  https://wallet.example/mcp \
  --header "Authorization: Bearer $MAXWELLS_WALLET_MCP_TOKEN"
```

An equivalent project `.mcp.json` uses an environment-variable expansion. Do not commit a literal token:

```json
{
  "mcpServers": {
    "maxwells-wallet": {
      "type": "http",
      "url": "https://wallet.example/mcp",
      "headers": {
        "Authorization": "Bearer ${MAXWELLS_WALLET_MCP_TOKEN}"
      }
    }
  }
}
```

A reverse proxy or tunnel must forward `POST /mcp`, the `Authorization` header, and the MCP request and response bodies without buffering or rewriting them. Include its `Host` value in `MCP_ALLOWED_HOSTS`, a comma-separated allowlist used by the SDK's DNS-rebinding protection. The default is `localhost,localhost:*,127.0.0.1,127.0.0.1:*,test`.

## Tool reference

All result sets are capped at 200 rows unless a lower limit is stated. `dry_run` reports changes without committing them.

### Read tools

| Tool | Scope | Purpose | Key parameters and limits |
|---|---|---|---|
| `list_tags` | `read` | List tags, optionally by namespace. | `namespace`; `limit` max 200 |
| `list_accounts` | `read` | List distinct transaction account sources. | `limit` max 200 |
| `search_transactions` | `read` | Search and filter transactions. | `text`, ISO `start_date`/`end_date`, `tags` as `namespace:value`, `account_source`, `amount_min`/`amount_max`, `uncategorized_only`, `limit` max 200, `offset` |
| `get_transaction` | `read` | Fetch one transaction and its tags. | `transaction_id` |
| `spending_summary` | `read` | Summarize non-transfer spending. | ISO date range; `group_by`: `bucket`, `merchant`, `month`, `account`, or `tag` |
| `top_merchants` | `read` | Rank merchants by spending magnitude. | ISO date range; `limit` max 200 (default 10) |
| `list_rules` | `read` | List tag rules by priority. | `limit` max 200 |
| `preview_rule` | `read` | Test unsaved rule conditions and return a sample. | At least one merchant, description, amount, or account condition; sample `limit` max 200 |
| `list_dashboards` | `read` | List dashboards and widgets. | `limit` max 200 |
| `get_dashboard` | `read` | Fetch one dashboard and its widget configuration. | `dashboard_id` |

### Write tools

These tools require `write` and are refused when `DEMO_MODE=true`.

| Tool | Scope | Purpose | Key parameters and limits |
|---|---|---|---|
| `create_tag` | `write` | Create one `namespace:value` tag. | `tag`; optional description, color, sort order |
| `add_tag_to_transactions` | `write` | Add an existing tag link. | `transaction_ids` 1–500 unique IDs; `tag`; `dry_run` |
| `remove_tag_from_transactions` | `write` | Remove one tag link. | `transaction_ids` 1–500 unique IDs; `tag`; `dry_run` |
| `set_bucket` | `write` | Replace the bucket tag on transactions. | `transaction_ids` 1–500 unique IDs; `bucket` must be `bucket:value`; `dry_run` |
| `create_rule` | `write` | Create a validated tag rule. | `name`, existing `tag`, at least one condition, optional priority/enabled |
| `update_rule` | `write` | Update a tag rule while retaining validation. | `rule_id`; changed rule fields must leave at least one condition |
| `delete_rule` | `write` | Delete one tag rule. | `rule_id` |
| `apply_rules` | `write` | Apply enabled rules to matching transactions. | Optional `rule_id`; `dry_run` |
| `create_dashboard` | `write` | Create a dashboard. | `name`; optional description, date range, default flag, position |
| `add_dashboard_widget` | `write` | Add a validated widget to a dashboard. | `dashboard_id`; `widget_type`: `summary`, `velocity`, `anomalies`, `bucket_pie`, `top_merchants`, `trends`, `sankey`, `treemap`, or `heatmap`; `width`: `half` or `full`; position/config/visibility |

### Classification tools

These are read-only and require `read`. They never write suggestions to the database.

| Tool | Scope | Purpose | Key parameters and limits |
|---|---|---|---|
| `suggest_tags` | `read` | Suggest bucket tags for selected or uncategorized transactions. | `transaction_ids` max 100, or `limit` max 100; `min_confidence` 0–1 |
| `suggest_rules` | `read` | Mine repeatable conditions from the 5,000 most recent uncategorized transactions. | `min_support` max 100; `limit` max 100 |
| `classifier_status` | `read` | Report provider selection and whether data leaves the instance. | No parameters; never exposes the API key |

## Safety and auditability

Stored tokens are HMAC-SHA-256 digests keyed from `SECRET_KEY`, so the database alone cannot be used to check a token. Set `SECRET_KEY` to a long random value, and note that rotating it invalidates every issued token.


MCP cannot create or delete transactions or change their amount, date, merchant, description, account, hash, or reconciliation fields. Its transaction writes only add or remove tag links, or replace bucket tag links. It can create, update, delete, and apply tag rules. It can create dashboards and add widgets, but cannot edit or delete existing dashboards or widgets. It cannot write budgets.

Use `dry_run=true` on bulk tag, bucket, and rule-application tools to inspect counts before committing. Write tools refuse all writes in demo mode. Every write tool logs the structured `mcp_write_tool` event with the tool name, token ID, user ID, change counts, and `dry_run` state. The raw token is never logged.

## Classification providers and privacy

The default `local` provider uses the existing bucket-tag inference and enabled tag rules. It keeps transaction data in the instance. `suggest_rules` is deterministic local rule mining.

The optional `jev` provider is selected with `CLASSIFIER_PROVIDER=jev` and requires `JEV_API_KEY`. It sends merchant, description, amount, date, and account source to TypeSafe AI's Jev System One API. It does not send transaction IDs. `JEV_BASE_URL` controls the service base URL and defaults to `https://api.typesafe.ai`.

The Jev adapter targets `POST /v1/systemone`. Its module documentation says the public documentation does not establish API rate limits, data retention, or a feedback API. The adapter therefore remains opt-in and confines wire assumptions to its request and response parsing. The adapter has not been run against the live service, so treat it as an unverified integration until you have tested it with your own key. With no key, the provider falls back to local and reports that in `classifier_status`.

## Suggested workflows

Ask the client to:

- “Analyse my spending for 2026-10, grouped by bucket, then show the top merchants.”
- “Find uncategorized spending and propose repeatable rules. Review the `suggest_rules` proposals, preview matches, create the approved rule, then run `apply_rules` with `dry_run=true` before asking me for approval to apply it.”
- “Create a dashboard called Monthly review, then add spending summary and top merchant widgets using only the allowed widget types.”

## Configuration

These are the environment variables read by the MCP and classification feature:

| Variable | Default | Effect |
|---|---|---|
| `MCP_ENABLED` | `true` | Mount or disable `/mcp`. |
| `MCP_ALLOWED_HOSTS` | `localhost,localhost:*,127.0.0.1,127.0.0.1:*,test` | Comma-separated Host allowlist for MCP transport security. |
| `DEMO_MODE` | `false` | Refuse MCP write tools when enabled. |
| `CLASSIFIER_PROVIDER` | `local` | Select `local` or opt-in `jev`; unsupported values fall back to local. |
| `JEV_API_KEY` | empty | Enables authenticated Jev requests when the Jev provider is selected. |
| `JEV_BASE_URL` | `https://api.typesafe.ai` | Base URL for Jev System One. |

See [the API token implementation](../backend/app/services/api_tokens.py) and [the MCP package](../backend/app/mcp/) for the implementation details.
