import test from "node:test";
import assert from "node:assert/strict";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";

import { createUpvoteClubServer } from "../create-server.js";
import {
  SOCIAL_NETWORKS,
  detectNetworkFromUrl,
} from "../platforms.js";


async function connectedClient(config = {}) {
  const server = createUpvoteClubServer(config);
  const client = new Client({
    name: "upvote-club-core-test",
    version: "1.0.0",
  });
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  return { client, server };
}


// ─── Ariadne's Thread [AT-2250] ─────────────────────
// What: Verify the production platform catalog, structured results, and OAuth challenge contract.
// Why:  Every delivery package depends on this core and must expose identical safe behavior.
// Date: 2026-10-12
// Related: [AT-2243] core→platforms.js:SOCIAL_NETWORKS,
//          [AT-2244] core→create-server.js:registerUpvoteClubTools
// ─────────────────────────────────────────────────────
test("platform catalog matches active production actions", () => {
  assert.equal(SOCIAL_NETWORKS.length, 18);
  const actions = Object.fromEntries(
    SOCIAL_NETWORKS.map((network) => [
      network.code,
      [...network.availableActions].sort(),
    ]),
  );
  assert.deepEqual(actions.LINKEDIN, [
    "COMMENT",
    "CONNECT",
    "FOLLOW",
    "LIKE",
    "SAVE",
  ]);
  assert.deepEqual(actions.QUORA, [
    "COMMENT",
    "DOWNVOTE",
    "FOLLOW",
    "SHARE",
    "UPVOTE",
  ]);
  assert.deepEqual(actions.THREADS, [
    "COMMENT",
    "FOLLOW",
    "LIKE",
    "SAVE",
  ]);
  assert.equal(
    detectNetworkFromUrl("https://www.threads.com/@upvote/post/123"),
    "THREADS",
  );
});

test("anonymous catalog call returns structured content", async () => {
  const { client, server } = await connectedClient();
  try {
    const tools = await client.listTools();
    const listTool = tools.tools.find((tool) => tool.name === "list_platforms");
    assert.deepEqual(listTool._meta.securitySchemes, [
      { type: "oauth2", scopes: ["tasks:read"] },
    ]);

    const result = await client.callTool({
      name: "list_platforms",
      arguments: {},
    });
    assert.equal(result.isError, false);
    assert.equal(result.structuredContent.success, true);
    assert.equal(result.structuredContent.platforms.length, 18);
  } finally {
    await client.close();
    await server.close();
  }
});

test("protected tool returns an OAuth challenge without credentials", async () => {
  const { client, server } = await connectedClient({
    oauthResourceMetadataUrl:
      "https://mcp.upvote.club/.well-known/oauth-protected-resource",
  });
  try {
    const tools = await client.listTools();
    const createTool = tools.tools.find((tool) => tool.name === "create_task");
    assert.deepEqual(createTool._meta.securitySchemes, [
      { type: "oauth2", scopes: ["tasks:write"] },
    ]);

    const result = await client.callTool({
      name: "create_task",
      arguments: {
        post_url: "https://www.reddit.com/r/test/comments/abc/post",
        type: "UPVOTE",
        price: 4,
        actions_required: 1,
      },
    });
    assert.equal(result.isError, true);
    assert.equal(result.structuredContent.required_scope, "tasks:write");
    assert.match(
      result._meta["mcp/www_authenticate"][0],
      /resource_metadata="https:\/\/mcp\.upvote\.club\/\.well-known\/oauth-protected-resource"/,
    );
  } finally {
    await client.close();
    await server.close();
  }
});
