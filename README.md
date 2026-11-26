# @upvote-club/mcp-core

Shared MCP server for the [Upvote.club Public API](https://upvote.club/api).

## Upvote Club MCP packages

| Package | Repository | Use case |
|---------|------------|----------|
| **Core** | **This repo** — [upvote-club-mcp-core](https://github.com/upvoteclub/upvote-club-mcp-core) | Shared MCP server library (6 tools) |
| Local | [upvote-club-mcp-local](https://github.com/upvoteclub/upvote-club-mcp-local) | Cursor, Claude Code, manual Claude Desktop (`stdio`) |
| MCPB | [upvote-club-mcp-mcpb](https://github.com/upvoteclub/upvote-club-mcp-mcpb) | Single-click Claude Desktop `.mcpb` install |
| Remote | [upvote-club-mcp-remote](https://github.com/upvoteclub/upvote-club-mcp-remote) | Canonical remote server: OAuth, API keys, and MCP Apps UI |

Public API UI: [upvote.club/api](https://upvote.club/api)

## Setup

1. Register at **https://upvote.club**
2. Active **MEMBER** or **MATE** plan
3. Remote MCP: connect with OAuth
4. Local MCP: generate a key at **https://upvote.club/api** and set `UPVOTE_API_KEY=upv_...`

Use the canonical **Remote** endpoint for HTTP MCP hosts. Install **Local** or **MCPB** only when a local stdio process is required.

## Tools (16)

| Tool | Auth |
|------|------|
| `get_api_reference` | No API call |
| `list_platforms` | No API call |
| `get_balance` | OAuth or API key |
| `create_task` | OAuth or API key |
| `get_task_status` | OAuth or API key |
| `delete_task` | OAuth or API key |
| `create_directory_project` | OAuth or API key |
| `list_directory_projects` | OAuth or API key |
| `get_directory_project` | OAuth or API key |
| `submit_to_directories` | OAuth or API key |
| `get_directory_submissions` | OAuth or API key |
| `create_forum_project` | OAuth or API key |
| `list_forum_projects` | OAuth or API key |
| `get_forum_project` | OAuth or API key |
| `place_forum_backlinks` | OAuth or API key |
| `get_forum_placements` | OAuth or API key |

Remote MCP requires OAuth or an API key on every request, including the catalog tools.

Full reference: [docs/API_REFERENCE.md](docs/API_REFERENCE.md)

## Used by

- [upvote-club-mcp-local](https://github.com/upvoteclub/upvote-club-mcp-local)
- [upvote-club-mcp-mcpb](https://github.com/upvoteclub/upvote-club-mcp-mcpb)
- [upvote-club-mcp-remote](https://github.com/upvoteclub/upvote-club-mcp-remote)

## Privacy

Connects only to `https://api.upvote.club`. [Privacy policy](https://upvote.club/privacy-policy)
