# @upvote-club/mcp-core

Shared MCP server for the [Upvote.club Public API](https://upvote.club/api).

## Upvote Club MCP packages

| Package | Repository | Use case |
|---------|------------|----------|
| **Core** | **This repo** — [upvote-club-mcp-core](https://github.com/upvoteclub/upvote-club-mcp-core) | Shared MCP server library (6 tools) |
| Local | [upvote-club-mcp-local](https://github.com/upvoteclub/upvote-club-mcp-local) | Cursor, Claude Code, manual Claude Desktop (`stdio`) |
| MCPB | [upvote-club-mcp-mcpb](https://github.com/upvoteclub/upvote-club-mcp-mcpb) | Single-click Claude Desktop `.mcpb` install |
| Remote | [upvote-club-mcp-remote](https://github.com/upvoteclub/upvote-club-mcp-remote) | Claude.ai custom connector (Streamable HTTP) |
| Apps | [upvote-club-mcp-apps](https://github.com/upvoteclub/upvote-club-mcp-apps) | MCP Apps + inline task progress UI |

Public API UI: [upvote.club/api](https://upvote.club/api)

## Setup

1. Register at **https://upvote.club**
2. **MATE** plan
3. Generate API key at **https://upvote.club/api**
4. Set `UPVOTE_API_KEY=upv_...` in your MCP config

Install a delivery package above — **Local**, **MCPB**, **Remote**, or **Apps** — not this core repo directly unless you are building on top of it.

## Tools (6)

| Tool | Auth |
|------|------|
| `get_api_reference` | none |
| `list_platforms` | none |
| `create_task` | API key |
| `get_task_status` | API key |
| `delete_task` | API key |

Full reference: [docs/API_REFERENCE.md](docs/API_REFERENCE.md)

## Used by

- [upvote-club-mcp-local](https://github.com/upvoteclub/upvote-club-mcp-local)
- [upvote-club-mcp-mcpb](https://github.com/upvoteclub/upvote-club-mcp-mcpb)
- [upvote-club-mcp-remote](https://github.com/upvoteclub/upvote-club-mcp-remote)
- [upvote-club-mcp-apps](https://github.com/upvoteclub/upvote-club-mcp-apps)

## Privacy

Connects only to `https://api.upvote.club`. [Privacy policy](https://upvote.club/privacy-policy)
