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

## Tools (7)

| Tool | Auth |
|------|------|
| `list_platforms` | none |
| `list_api_keys` | JWT (`UPVOTE_JWT`) |
| `generate_api_key` | JWT |
| `create_task` | API key |
| `get_task_status` | API key |
| `delete_task` | API key |

## Exports

- `@upvote-club/mcp-core` → `createUpvoteClubServer`, `registerUpvoteClubTools`
- `@upvote-club/mcp-core/platforms` → platform catalog helpers
