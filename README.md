# @upvote-club/mcp-core

Shared MCP server factory for the [Upvote.club Public API](https://upvote.club/api).

Used by:

- [upvote-club-mcp-local](https://github.com/alxgntv/upvote-club-mcp-local)
- [upvote-club-mcp-mcpb](https://github.com/alxgntv/upvote-club-mcp-mcpb)
- [upvote-club-mcp-remote](https://github.com/alxgntv/upvote-club-mcp-remote)
- [upvote-club-mcp-apps](https://github.com/alxgntv/upvote-club-mcp-apps)

## Install

```bash
npm install github:alxgntv/upvote-club-mcp-core
```

## Usage

```js
import { createUpvoteClubServer } from "@upvote-club/mcp-core";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

const server = createUpvoteClubServer({
  apiKey: process.env.UPVOTE_API_KEY,
  logPrefix: "[my-mcp]",
});
await server.connect(new StdioServerTransport());
```

## Tools (8)

| Tool | Auth | Description |
|------|------|-------------|
| `get_api_reference` | none | **Full docs**: request examples, min prices, all errors |
| `list_platforms` | none | Platforms + min price per action |
| `list_api_keys` | JWT | Active key metadata |
| `generate_api_key` | JWT | New `upv_...` key (shown once) |
| `create_task` | API key | Create promotion task |
| `get_task_status` | API key | Progress + comment evidence |
| `delete_task` | API key | Cancel + refund unused points |

**Full reference:** [docs/API_REFERENCE.md](docs/API_REFERENCE.md) — examples, pricing, error catalog.

## Exports

- `@upvote-club/mcp-core` → `createUpvoteClubServer`, `registerUpvoteClubTools`
- `@upvote-club/mcp-core/platforms` → platform catalog helpers
- `@upvote-club/mcp-core/api-reference` → `API_REFERENCE` object
