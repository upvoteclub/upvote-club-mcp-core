import test from "node:test";
import assert from "node:assert/strict";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";

import { createUpvoteClubServer } from "../create-server.js";

// ─── Ariadne's Thread [AT-3851] ─────────────────────
// What: Check what the Directory Submissions and Forum Backlinks tools send to the Public API.
// Why:  Agents create projects and submit/place by ID through these tools; scopes and bodies
//       must match the backend endpoints.
// Date: 2026-11-26
// Related: [AT-3850] core→backlinks-tools.js
// ─────────────────────────────────────────────────────

async function withClient(fn, { responseBody = { success: true }, status = 200, config = {} } = {}) {
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
  const server = createUpvoteClubServer({
    apiKey: "upv_test_key",
    apiUrl: "https://api.example.test",
    ...config,
  });
  const client = new Client({ name: "backlinks-test", version: "1.0.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  try {
    await fn(client, calls);
  } finally {
    globalThis.fetch = original;
    await client.close();
    await server.close();
  }
}

const BASE = "https://api.example.test/api/public-api";

test("backlink tools are listed with read and write scopes", async () => {
  await withClient(async (client) => {
    const { tools } = await client.listTools();
    const byName = Object.fromEntries(tools.map((tool) => [tool.name, tool]));
    for (const name of [
      "create_directory_project",
      "submit_to_directories",
      "create_forum_project",
      "place_forum_backlinks",
    ]) {
      assert.deepEqual(byName[name]._meta.securitySchemes, [{ type: "oauth2", scopes: ["tasks:write"] }], name);
    }
    for (const name of [
      "list_directory_projects",
      "get_directory_project",
      "get_directory_submissions",
      "list_forum_projects",
      "get_forum_project",
      "get_forum_placements",
    ]) {
      assert.deepEqual(byName[name]._meta.securitySchemes, [{ type: "oauth2", scopes: ["tasks:read"] }], name);
    }
  });
});

test("create_directory_project posts the card and can keep only available rows", async () => {
  const responseBody = {
    success: true,
    project: { id: 5, ready_to_submit: true },
    directories: [
      { id: 1, can_submit: true },
      { id: 2, can_submit: false },
    ],
  };
  await withClient(
    async (client, calls) => {
      const result = await client.callTool({
        name: "create_directory_project",
        arguments: {
          domain: "example.com",
          title: "Example",
          description: "Example app",
          favicon_url: "https://example.com/f.png",
          thumbnail_url: "https://example.com/c.png",
          categories: ["SaaS"],
          only_available: true,
        },
      });
      assert.equal(result.isError, false);
      assert.equal(calls.length, 1);
      assert.equal(calls[0].method, "POST");
      assert.equal(calls[0].url, `${BASE}/directory-submissions/projects/`);
      assert.equal(calls[0].headers["X-API-Key"], "upv_test_key");
      assert.deepEqual(calls[0].body, {
        domain: "example.com",
        title: "Example",
        description: "Example app",
        favicon_url: "https://example.com/f.png",
        thumbnail_url: "https://example.com/c.png",
        categories: ["SaaS"],
      });
      assert.deepEqual(result.structuredContent.directories.map((row) => row.id), [1]);
    },
    { responseBody, status: 201 },
  );
});

test("submit_to_directories sends the IDs and caps a call at 10", async () => {
  await withClient(async (client, calls) => {
    const result = await client.callTool({
      name: "submit_to_directories",
      arguments: { project_id: 5, directory_ids: [11, 12] },
    });
    assert.equal(result.isError, false);
    assert.equal(calls[0].url, `${BASE}/directory-submissions/projects/5/submit/`);
    assert.deepEqual(calls[0].body, { directory_ids: [11, 12] });

    const tooMany = await client.callTool({
      name: "submit_to_directories",
      arguments: { project_id: 5, directory_ids: Array.from({ length: 11 }, (_, i) => i + 1) },
    });
    assert.equal(tooMany.isError, true);
    assert.equal(calls.length, 1);
  });
});

test("API errors come back as tool errors with the HTTP status", async () => {
  await withClient(
    async (client) => {
      const result = await client.callTool({
        name: "get_directory_project",
        arguments: { project_id: 99 },
      });
      assert.equal(result.isError, true);
      assert.equal(result.structuredContent.http_status, 404);
      assert.equal(result.structuredContent.error, "Project not found.");
    },
    { responseBody: { success: false, error: "Project not found." }, status: 404 },
  );
});

test("place_forum_backlinks sends forum_ids with one anchor or per-forum placements", async () => {
  await withClient(async (client, calls) => {
    await client.callTool({
      name: "place_forum_backlinks",
      arguments: {
        project_id: 7,
        forum_ids: [4173],
        keyword: "best tool",
        target_url: "https://example.com/page",
      },
    });
    assert.equal(calls[0].url, `${BASE}/forum-backlinks/projects/7/place/`);
    assert.deepEqual(calls[0].body, {
      forum_ids: [4173],
      keyword: "best tool",
      target_url: "https://example.com/page",
    });

    await client.callTool({
      name: "place_forum_backlinks",
      arguments: {
        project_id: 7,
        placements: [{ forum_id: 4174, keyword: "other", target_url: "https://example.com/b" }],
      },
    });
    assert.deepEqual(calls[1].body, {
      placements: [{ forum_id: 4174, keyword: "other", target_url: "https://example.com/b" }],
    });

    const incomplete = await client.callTool({
      name: "place_forum_backlinks",
      arguments: { project_id: 7, forum_ids: [4173] },
    });
    assert.equal(incomplete.isError, true);
    assert.equal(calls.length, 2);
  });
});

test("an OAuth account with read scope cannot submit", async () => {
  await withClient(
    async (client, calls) => {
      const read = await client.callTool({ name: "list_forum_projects", arguments: {} });
      assert.equal(read.isError, false);
      assert.equal(calls[0].headers["X-MCP-OAuth-Scopes"], "tasks:read");
      const write = await client.callTool({
        name: "submit_to_directories",
        arguments: { project_id: 5, directory_ids: [1] },
      });
      assert.equal(write.isError, true);
      assert.equal(write.structuredContent.required_scope, "tasks:write");
      assert.equal(calls.length, 1);
    },
    {
      config: {
        apiKey: "",
        serviceAuth: { userId: 42, scopes: ["tasks:read"], internalSecret: "secret" },
      },
    },
  );
});
