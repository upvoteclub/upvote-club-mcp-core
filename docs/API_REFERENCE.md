# Upvote.club Public API — MCP Reference

Full reference for all MCP tools. Machine-readable copy: call **`get_api_reference`** tool or read [`api-reference.js`](api-reference.js).

## Auth

| Tool | Auth |
|------|------|
| `list_platforms`, `get_api_reference` | none |
| `list_api_keys`, `generate_api_key` | JWT (`UPVOTE_JWT`) |
| `create_task`, `get_task_status`, `delete_task` | API key (`UPVOTE_API_KEY`, header `X-API-Key`) |

**MATE plan** required for API access.

## Pricing

| Rule | Value |
|------|-------|
| Global minimum per action | 2 points |
| GitHub / Product Hunt | 16 points per action |
| Meaningful COMMENT | 64 points per action |
| Charge | `price × actions_required` (plan discount on create) |
| Daily slot | 1 slot per `create_task` |
| Refund | `delete_task` refunds incomplete actions |

See `minPricesByAction` in `list_platforms` output.

## create_task — examples

### Reddit upvotes

```json
{
  "post_url": "https://www.reddit.com/r/startups/comments/abc123/my_launch/",
  "type": "UPVOTE",
  "social_network_code": "REDDIT",
  "price": 4,
  "actions_required": 20
}
```

### Product Hunt (min 16/action)

```json
{
  "post_url": "https://www.producthunt.com/posts/my-product",
  "type": "UPVOTE",
  "social_network_code": "PRODUCTHUNT",
  "price": 16,
  "actions_required": 50
}
```

### Meaningful comment (min 64/action)

```json
{
  "post_url": "https://www.reddit.com/r/SaaS/comments/xyz/post/",
  "type": "COMMENT",
  "social_network_code": "REDDIT",
  "price": 64,
  "actions_required": 5,
  "meaningful_comment": true,
  "meaningful_comments": [{ "text": "Really helpful breakdown." }]
}
```

### MULTI_ACTION bundle

```json
{
  "post_url": "https://twitter.com/user/status/123456789",
  "type": "MULTI_ACTION",
  "social_network_code": "TWITTER",
  "multi_action_items": [
    { "action_type": "LIKE", "price": 2, "actions_required": 10 },
    {
      "action_type": "COMMENT",
      "price": 64,
      "actions_required": 2,
      "meaningful_comment": true,
      "meaningful_comments": [{ "text": "Solid thread." }]
    }
  ]
}
```

## create_task — errors

| HTTP | Error |
|------|-------|
| 401 | Invalid or missing API key |
| 403 | MATE plan required |
| 403 | Profile verification required (`needs_verification: true`) |
| 400 | Missing required fields |
| 400 | Minimum price per action is 2 points |
| 400 | No available tasks left |
| 400 | Insufficient balance (`required_balance`, `current_balance`) |
| 400 | Duplicate URL+type+platform (`existing_task_id`) |
| 400 | meaningful_comments required / no links in comments |
| 400 | Invalid multi_action_items |

## get_task_status

```json
{ "task_ids": [12345, 12346] }
```

Returns `progress_percentage`, `action_completions` (meaningful comments), `multi_action_items` for bundles.

## delete_task

```json
{ "task_id": 12345 }
```

Completed tasks cannot be deleted (400).

## Tools (8)

| Tool | Purpose |
|------|---------|
| `get_api_reference` | Full docs (this content + JSON) |
| `list_platforms` | Platforms, actions, min prices |
| `list_api_keys` | Key metadata |
| `generate_api_key` | New key (once) |
| `create_task` | Create promotion |
| `get_task_status` | Track progress |
| `delete_task` | Cancel + refund |

Source of truth: `front-upvote-club/src/data/apiDocumentation.json` + `back-upvote-club/api/public_api_views.py`
