# Upvote.club Public API — MCP Reference

## Setup

1. Register at **https://upvote.club**
2. Activate the **MEMBER** or **MATE** plan
3. Remote MCP: connect your Upvote.club account with OAuth
4. Local MCP: generate an API key (`upv_...`) at **https://upvote.club/api**

The key is shown only once — save it securely. To rotate, generate a new key at https://upvote.club/api

## Auth

| Field | Value |
|-------|-------|
| Remote MCP | OAuth 2.1 authorization code + PKCE |
| API-key header | `X-API-Key: upv_...` |
| Local env var | `UPVOTE_API_KEY` |
| Generate API key | https://upvote.club/api |

## Pricing

| Rule | Value |
|------|-------|
| Global minimum per action | 2 points |
| GitHub / Product Hunt | 16 points per action |
| Meaningful COMMENT | 64 points per action |
| Charge | `price × actions_required` (plan discount on create) |
| Daily slot | 1 slot per `create_task` |
| Refund | `delete_task` refunds incomplete actions |

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
  "actions_required": 1,
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
      "actions_required": 1,
      "meaningful_comment": true,
      "meaningful_comments": [{ "text": "Solid thread." }]
    }
  ]
}
```

### Long comment from the Upvote.club bank

```json
{
  "post_url": "https://www.reddit.com/r/SaaS/comments/xyz/post/",
  "type": "COMMENT",
  "social_network_code": "REDDIT",
  "price": 4,
  "actions_required": 5,
  "long_comment": true
}
```

## create_task — errors

| HTTP | Error |
|------|-------|
| 401 | Invalid or missing OAuth/API-key credentials |
| 403 | MEMBER or MATE plan required |
| 400 | Missing required fields |
| 400 | Minimum price per action is 2 points |
| 400 | No available tasks left |
| 400 | Insufficient balance |
| 400 | Duplicate URL+type+platform |
| 400 | meaningful_comments required, insufficient text count, or links present |
| 400 | long_comment and meaningful_comment enabled together |

## Tools (5)

| Tool | Auth | Purpose |
|------|------|---------|
| `get_api_reference` | No API call | Full docs (JSON) |
| `list_platforms` | No API call | Platforms + min prices |
| `create_task` | OAuth or API key | Create promotion |
| `get_task_status` | OAuth or API key | Track progress |
| `delete_task` | OAuth or API key | Cancel + refund |

Remote MCP requires OAuth or an API key on every request, including the catalog tools.

Machine-readable: call `get_api_reference` or read `api-reference.js`.
