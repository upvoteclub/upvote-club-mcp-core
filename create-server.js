// ─── Ariadne's Thread [AT-0533] ─────────────────────
// What: Shared MCP server factory for Upvote.club Public API — all 7 backend endpoints as MCP tools
// Why:  Single implementation reused by local stdio, MCPB, remote HTTP, and MCP Apps packages
// Date: 2026-07-14
// Related: backend→api/public_api_views.py, backend→api/urls.py:public-api/*
// ─────────────────────────────────────────────────────
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  SOCIAL_NETWORKS,
  HIGH_MIN_PRICE_NETWORKS,
  MEANINGFUL_COMMENT_MIN_PRICE,
  ALL_ACTION_TYPES,
  detectNetworkFromUrl,
  getNetwork,
  minPriceFor,
} from "./platforms.js";

const DEFAULT_API_URL = "https://api.upvote.club";

/**
 * @param {{ apiKey?: string, jwtToken?: string, apiUrl?: string, logPrefix?: string }} config
 * @param {{ skipTools?: string[] }} options
 */
export function registerUpvoteClubTools(server, config = {}, options = {}) {
  const skipTools = new Set(options.skipTools || []);
  const apiUrl = (config.apiUrl || process.env.UPVOTE_API_URL || DEFAULT_API_URL).replace(/\/+$/, "");
  const apiKey = config.apiKey ?? process.env.UPVOTE_API_KEY ?? "";
  const jwtToken = config.jwtToken ?? process.env.UPVOTE_JWT ?? "";
  const logPrefix = config.logPrefix || "[upvote-mcp]";

  async function apiRequest(method, path, body = null, authMode = "api_key") {
    const headers = { "Content-Type": "application/json" };

    if (authMode === "api_key") {
      if (!apiKey) {
        console.error(`${logPrefix} apiRequest aborted: UPVOTE_API_KEY is not configured`);
        return {
          ok: false,
          status: 0,
          data: {
            success: false,
            error:
              "API key is not configured. Set UPVOTE_API_KEY (generate at https://upvote.club/api — requires MATE plan).",
          },
        };
      }
      headers["X-API-Key"] = apiKey;
    } else if (authMode === "jwt") {
      if (!jwtToken) {
        console.error(`${logPrefix} apiRequest aborted: UPVOTE_JWT is not configured`);
        return {
          ok: false,
          status: 0,
          data: {
            success: false,
            error:
              "JWT token is not configured. Set UPVOTE_JWT (Firebase access token from an authenticated Upvote.club session). Required for list_api_keys and generate_api_key.",
          },
        };
      }
      headers["Authorization"] = `Bearer ${jwtToken}`;
    }

    const url = `${apiUrl}${path}`;
    console.error(`${logPrefix} API request: ${method} ${url} auth=${authMode} body=${body ? JSON.stringify(body) : "none"}`);

    let response;
    try {
      response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(60000),
      });
    } catch (err) {
      console.error(`${logPrefix} API request network error: ${method} ${url} error=${err.message}`);
      return {
        ok: false,
        status: 0,
        data: { success: false, error: `Network error while reaching Upvote.club API: ${err.message}` },
      };
    }

    let data;
    const rawText = await response.text();
    try {
      data = rawText ? JSON.parse(rawText) : {};
    } catch (err) {
      console.error(`${logPrefix} API response is not JSON: status=${response.status} body=${rawText.slice(0, 500)}`);
      data = { success: false, error: `Unexpected non-JSON response from API (HTTP ${response.status})` };
    }

    console.error(`${logPrefix} API response: ${method} ${url} status=${response.status} body=${rawText.slice(0, 2000)}`);
    return { ok: response.ok, status: response.status, data };
  }

  function toolResult(payload, isError = false) {
    return {
      content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
      isError,
    };
  }

  server.registerTool(
    "list_platforms",
    {
      title: "List Supported Platforms",
      description:
        "List all social platforms supported by Upvote.club with their available promotion actions, minimum price per action (in points), and example URLs. Call this first if you are unsure which platform or action applies to the link the user wants to promote.",
      inputSchema: {},
      annotations: {
        readOnlyHint: true,
        openWorldHint: false,
      },
    },
    async () => {
      console.error(`${logPrefix} Tool call: list_platforms`);
      const platforms = SOCIAL_NETWORKS.map((n) => ({
        code: n.code,
        name: n.name,
        availableActions: n.availableActions.map((a) => ({
          action: a,
          minPricePerActionPoints: minPriceFor(n.code, a),
        })),
        postUrlExample: n.postUrlExample,
        profileUrlExample: n.profileUrlExample,
        domains: n.domains,
      }));
      return toolResult({
        success: true,
        platforms,
        notes: [
          "Prices are in Upvote.club points, charged per completed action.",
          `COMMENT actions with meaningful_comment enabled require at least ${MEANINGFUL_COMMENT_MIN_PRICE} points per action.`,
          `GitHub and Product Hunt actions require at least ${HIGH_MIN_PRICE_NETWORKS.GITHUB} points per action.`,
          "Creating tasks via API requires an Upvote.club MATE plan, sufficient point balance, and an available daily task slot.",
        ],
      });
    }
  );

  server.registerTool(
    "list_api_keys",
    {
      title: "List API Keys",
      description:
        "List the active Upvote.club API key metadata for the authenticated account (preview hash, created_at, last_used_at). Requires UPVOTE_JWT (session token), not the API key itself.",
      inputSchema: {},
      annotations: {
        readOnlyHint: true,
        openWorldHint: false,
      },
    },
    async () => {
      console.error(`${logPrefix} Tool call: list_api_keys`);
      const { ok, status, data } = await apiRequest("GET", "/api/public-api/list-keys/", null, "jwt");
      if (!ok) {
        return toolResult({ success: false, http_status: status, ...data }, true);
      }
      return toolResult(data);
    }
  );

  server.registerTool(
    "generate_api_key",
    {
      title: "Generate API Key",
      description:
        "Generate a new Upvote.club API key for the authenticated account. The full key is returned only once — save it securely. Deactivates any previous active key. Requires UPVOTE_JWT (session token) and MATE plan.",
      inputSchema: {
        name: z.string().optional().describe("Optional label for the API key"),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async (args) => {
      console.error(`${logPrefix} Tool call: generate_api_key args=${JSON.stringify(args)}`);
      const { ok, status, data } = await apiRequest(
        "POST",
        "/api/public-api/generate-key/",
        args.name ? { name: args.name } : {},
        "jwt"
      );
      if (!ok) {
        return toolResult({ success: false, http_status: status, ...data }, true);
      }
      return toolResult({
        ...data,
        hint: "Store the api_key value securely. Configure it as UPVOTE_API_KEY for create_task, get_task_status, and delete_task.",
      });
    }
  );

  const meaningfulCommentsSchema = z
    .array(z.object({ text: z.string().min(1).describe("Comment text executors must post (no links allowed)") }))
    .min(1)
    .describe('Comment texts for meaningful COMMENT actions, e.g. [{"text": "Great tool"}]');

  const multiActionItemSchema = z.object({
    action_type: z.enum(ALL_ACTION_TYPES).describe("Action type, must be unique within the bundle"),
    price: z.number().int().min(2).describe("Price per action in points"),
    actions_required: z.number().int().min(1).describe("How many actions of this type to order"),
    meaningful_comment: z.boolean().optional(),
    meaningful_comments: meaningfulCommentsSchema.optional(),
  });

  server.registerTool(
    "create_task",
    {
      title: "Create Promotion Task",
      description:
        "Create a promotion task on Upvote.club: real community members perform the requested action on the given URL. SPENDS points and one daily task slot — confirm with the user first. Auto-detects platform from URL when social_network_code is omitted.",
      inputSchema: {
        post_url: z.string().url().describe("URL of the post, profile, repo or product to promote"),
        type: z.enum([...ALL_ACTION_TYPES, "MULTI_ACTION"]).describe("Action type or MULTI_ACTION for bundles"),
        price: z.number().int().min(2).optional().describe("Price per action in points (single-action tasks)"),
        actions_required: z.number().int().min(1).optional().describe("Number of actions (single-action tasks)"),
        social_network_code: z.enum(SOCIAL_NETWORKS.map((n) => n.code)).optional(),
        meaningful_comment: z.boolean().optional(),
        meaningful_comments: meaningfulCommentsSchema.optional(),
        multi_action_items: z.array(multiActionItemSchema).min(2).optional(),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async (args) => {
      console.error(`${logPrefix} Tool call: create_task args=${JSON.stringify(args)}`);

      const isMulti = args.type === "MULTI_ACTION" || (Array.isArray(args.multi_action_items) && args.multi_action_items.length >= 2);

      const networkCode = args.social_network_code || detectNetworkFromUrl(args.post_url);
      if (!networkCode) {
        return toolResult(
          {
            success: false,
            error: "Could not detect platform from URL. Call list_platforms and pass social_network_code explicitly.",
          },
          true
        );
      }

      const network = getNetwork(networkCode);
      if (!network) {
        return toolResult({ success: false, error: `Unknown social_network_code: ${networkCode}` }, true);
      }

      if (isMulti) {
        for (const item of args.multi_action_items || []) {
          if (!network.availableActions.includes(item.action_type)) {
            return toolResult(
              {
                success: false,
                error: `Action ${item.action_type} is not available on ${network.name}. Available: ${network.availableActions.join(", ")}.`,
              },
              true
            );
          }
          const floor = minPriceFor(networkCode, item.action_type, Boolean(item.meaningful_comment));
          if (item.price < floor) {
            return toolResult(
              { success: false, error: `Price for ${item.action_type} on ${network.name} must be at least ${floor} points.` },
              true
            );
          }
        }
      } else {
        if (!network.availableActions.includes(args.type)) {
          return toolResult(
            {
              success: false,
              error: `Action ${args.type} is not available on ${network.name}. Available: ${network.availableActions.join(", ")}.`,
            },
            true
          );
        }
        if (args.price === undefined || args.actions_required === undefined) {
          return toolResult({ success: false, error: "price and actions_required are required for single-action tasks." }, true);
        }
        const floor = minPriceFor(networkCode, args.type, Boolean(args.meaningful_comment));
        if (args.price < floor) {
          return toolResult(
            { success: false, error: `Price for ${args.type} on ${network.name} must be at least ${floor} points.` },
            true
          );
        }
        if (args.meaningful_comment && (!args.meaningful_comments || args.meaningful_comments.length === 0)) {
          return toolResult(
            { success: false, error: 'meaningful_comments is required when meaningful_comment is enabled.' },
            true
          );
        }
      }

      const payload = {
        post_url: args.post_url,
        type: isMulti ? "MULTI_ACTION" : args.type,
        social_network_code: networkCode,
      };
      if (isMulti) {
        payload.multi_action_items = args.multi_action_items;
      } else {
        payload.price = args.price;
        payload.actions_required = args.actions_required;
        if (args.meaningful_comment) {
          payload.meaningful_comment = true;
          payload.meaningful_comments = args.meaningful_comments;
        }
      }

      const { ok, status, data } = await apiRequest("POST", "/api/public-api/create-task/", payload);
      if (!ok) {
        return toolResult({ success: false, http_status: status, ...data }, true);
      }

      return toolResult({
        ...data,
        dashboard_url: "https://upvote.club/dashboard/my-tasks",
        hint: "Use get_task_status to track progress. delete_task refunds unused points while incomplete.",
      });
    }
  );

  if (!skipTools.has("get_task_status")) {
  server.registerTool(
    "get_task_status",
    {
      title: "Get Task Status",
      description:
        "Get status and progress of one or more Upvote.club tasks (actions completed, progress percentage, meaningful comment submissions).",
      inputSchema: {
        task_ids: z.array(z.number().int().positive()).min(1).describe("Task IDs from create_task"),
      },
      annotations: {
        readOnlyHint: true,
        openWorldHint: true,
      },
    },
    async (args) => {
      console.error(`${logPrefix} Tool call: get_task_status task_ids=${args.task_ids.join(",")}`);
      const query = args.task_ids.join(",");
      const { ok, status, data } = await apiRequest("GET", `/api/public-api/task-status/?task_ids=${encodeURIComponent(query)}`);
      if (!ok) {
        return toolResult({ success: false, http_status: status, ...data }, true);
      }
      return toolResult(data);
    }
  );
  }

  if (!skipTools.has("delete_task")) {
  server.registerTool(
    "delete_task",
    {
      title: "Delete Task",
      description:
        "Delete an Upvote.club task. Refunds unused points and restores one daily task slot. Completed tasks cannot be deleted. Confirm with the user first.",
      inputSchema: {
        task_id: z.number().int().positive().describe("ID of the task to delete"),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (args) => {
      console.error(`${logPrefix} Tool call: delete_task task_id=${args.task_id}`);
      const { ok, status, data } = await apiRequest("DELETE", `/api/public-api/delete-task/${args.task_id}/`);
      if (!ok) {
        return toolResult({ success: false, http_status: status, ...data }, true);
      }
      return toolResult(data);
    }
  );
  }

  return { apiRequest, toolResult, logPrefix, apiUrl, apiKey };
}

export function createUpvoteClubServer(config = {}, options = {}) {
  const logPrefix = config.logPrefix || "[upvote-mcp]";
  console.error(`${logPrefix} createUpvoteClubServer starting`);

  const server = new McpServer({
    name: "upvote-club",
    version: "1.0.0",
  });

  registerUpvoteClubTools(server, config, options);
  return server;
}

export { DEFAULT_API_URL };
