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
    "FOLLOW",
    "UPVOTE",
  ]);
  assert.deepEqual(actions.GITHUB, ["FOLLOW", "STAR", "WATCH"]);
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


// ─── Ariadne's Thread [AT-3057] ─────────────────────
// What: Check what create_task and get_balance send to the Public API.
// Why:  MCP must create tasks like the website: pin, Long time view defaults, bundle rules, balance check.
// Date: 2026-11-10
// Related: [AT-3054] core→platforms.js, [AT-3055] [AT-3056] core→create-server.js
// ─────────────────────────────────────────────────────
function mockFetch(responseBody = { success: true, task_id: 1 }, status = 201) {
  const calls = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (url, init = {}) => {
    calls.push({
      url: String(url),
      method: init.method,
      headers: init.headers,
      body: init.body ? JSON.parse(init.body) : null,
    });
    return new Response(JSON.stringify(responseBody), { status });
  };
  return { calls, restore: () => { globalThis.fetch = original; } };
}

async function withApiKeyClient(fn, responseBody, status) {
  const fetchMock = mockFetch(responseBody, status);
  const { client, server } = await connectedClient({
    apiKey: "upv_test_key",
    apiUrl: "https://api.example.test",
  });
  try {
    await fn(client, fetchMock.calls);
  } finally {
    fetchMock.restore();
    await client.close();
    await server.close();
  }
}

test("create_task sends pin and Long time view like the website", async () => {
  await withApiKeyClient(async (client, calls) => {
    const single = await client.callTool({
      name: "create_task",
      arguments: {
        post_url: "https://www.reddit.com/r/test/comments/abc/post",
        type: "UPVOTE",
        price: 4,
        actions_required: 5,
        is_pinned: true,
      },
    });
    assert.equal(single.isError, false);
    const bundle = await client.callTool({
      name: "create_task",
      arguments: {
        post_url: "https://x.com/user/status/123",
        type: "MULTI_ACTION",
        multi_action_items: [
          { action_type: "LIKE", price: 2, actions_required: 10 },
          { action_type: "COMMENT", price: 4, actions_required: 3 },
        ],
      },
    });
    assert.equal(bundle.isError, false);
    const githubWatch = await client.callTool({
      name: "create_task",
      arguments: {
        post_url: "https://github.com/org/repo",
        type: "WATCH",
        price: 16,
        actions_required: 5,
        longview: true,
      },
    });
    assert.equal(githubWatch.isError, false);

    assert.equal(calls.length, 3);
    assert.equal(calls[0].url, "https://api.example.test/api/public-api/create-task/");
    assert.equal(calls[0].body.is_pinned, true);
    assert.equal(calls[0].body.longview, false);
    assert.equal(calls[1].body.type, "MULTI_ACTION");
    assert.equal(calls[1].body.longview, true);
    assert.equal(calls[1].body.social_network_code, "TWITTER");
    assert.equal(calls[2].body.social_network_code, "GITHUB");
    assert.equal(calls[2].body.longview, true);
  });
});

test("create_task rejects bundles and comments the website does not sell", async () => {
  await withApiKeyClient(async (client, calls) => {
    const meaningfulInBundle = await client.callTool({
      name: "create_task",
      arguments: {
        post_url: "https://x.com/user/status/123",
        type: "MULTI_ACTION",
        multi_action_items: [
          { action_type: "LIKE", price: 2, actions_required: 10 },
          {
            action_type: "COMMENT",
            price: 64,
            actions_required: 1,
            meaningful_comment: true,
            meaningful_comments: [{ text: "Nice" }],
          },
        ],
      },
    });
    assert.equal(meaningfulInBundle.isError, true);

    const connectInBundle = await client.callTool({
      name: "create_task",
      arguments: {
        post_url: "https://www.linkedin.com/posts/user_post-activity-1",
        type: "MULTI_ACTION",
        multi_action_items: [
          { action_type: "LIKE", price: 2, actions_required: 10 },
          { action_type: "CONNECT", price: 4, actions_required: 5 },
        ],
      },
    });
    assert.equal(connectInBundle.isError, true);
    assert.match(connectInBundle.structuredContent.error, /cannot be part of a MULTI_ACTION/);

    const meaningfulOnTwitter = await client.callTool({
      name: "create_task",
      arguments: {
        post_url: "https://x.com/user/status/123",
        type: "COMMENT",
        price: 64,
        actions_required: 1,
        meaningful_comment: true,
        meaningful_comments: [{ text: "Nice thread" }],
      },
    });
    assert.equal(meaningfulOnTwitter.isError, true);
    assert.match(meaningfulOnTwitter.structuredContent.error, /QUORA, REDDIT, LINKEDIN/);

    const quoraDownvote = await client.callTool({
      name: "create_task",
      arguments: {
        post_url: "https://www.quora.com/question-title",
        type: "DOWNVOTE",
        price: 4,
        actions_required: 1,
      },
    });
    assert.equal(quoraDownvote.isError, true);

    const cheapGithub = await client.callTool({
      name: "create_task",
      arguments: {
        post_url: "https://github.com/org/repo",
        type: "STAR",
        price: 2,
        actions_required: 1,
      },
    });
    assert.equal(cheapGithub.isError, true);

    assert.equal(calls.length, 0);
  });
});

test("get_balance reads the account balance", async () => {
  const balance = {
    success: true,
    balance: 1200,
    plan: "MATE",
    can_create_tasks: true,
    discount_percent: 40,
    task_slots_left: 10000,
    unlimited_task_slots: true,
  };
  await withApiKeyClient(async (client, calls) => {
    const tools = await client.listTools();
    const balanceTool = tools.tools.find((tool) => tool.name === "get_balance");
    assert.deepEqual(balanceTool._meta.securitySchemes, [
      { type: "oauth2", scopes: ["tasks:read"] },
    ]);
    const result = await client.callTool({ name: "get_balance", arguments: {} });
    assert.equal(result.isError, false);
    assert.equal(result.structuredContent.balance, 1200);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].method, "GET");
    assert.equal(calls[0].url, "https://api.example.test/api/public-api/balance/");
    assert.equal(calls[0].headers["X-API-Key"], "upv_test_key");
  }, balance, 200);
});
