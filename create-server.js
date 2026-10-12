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
  MIN_PRICES,
  detectNetworkFromUrl,
  getNetwork,
  minPriceFor,
} from "./platforms.js";
import { API_REFERENCE, getApiReferenceText } from "./api-reference.js";

const DEFAULT_API_URL = "https://api.upvote.club";
const DEFAULT_OAUTH_RESOURCE_METADATA_URL =
  "https://mcp.upvote.club/.well-known/oauth-protected-resource";

const TASK_READ_SECURITY_SCHEMES = [
  { type: "oauth2", scopes: ["tasks:read"] },
];
const TASK_WRITE_SECURITY_SCHEMES = [
  { type: "oauth2", scopes: ["tasks:write"] },
];

const platformOutputSchema = z
  .object({
    code: z.string(),
    name: z.string(),
    availableActions: z.array(
      z.object({
        action: z.string(),
        minPricePerActionPoints: z.number().int(),
      }),
    ),
    postUrlExample: z.string(),
    profileUrlExample: z.string(),
    domains: z.array(z.string()),
  })
  .passthrough();

const listPlatformsOutputSchema = z
  .object({
    success: z.boolean(),
    platforms: z.array(platformOutputSchema),
  })
  .passthrough();

const apiReferenceOutputSchema = z
  .object({
    success: z.boolean(),
    reference: z.record(z.unknown()),
  })
  .passthrough();

const publicApiOutputSchema = z
  .object({
    success: z.boolean(),
  })
  .passthrough();

function toolSecurityMeta(securitySchemes, extra = {}) {
  return {
    securitySchemes,
    ...extra,
  };
}

/**
 * @param {{
 *   apiKey?: string,
 *   apiUrl?: string,
 *   logPrefix?: string,
 *   oauthResourceMetadataUrl?: string,
 *   serviceAuth?: { userId: string|number, scopes: string[]|string, internalSecret: string }
 * }} config
 * @param {{ skipTools?: string[] }} options
 */
// ─── Ariadne's Thread [AT-2244] ─────────────────────
// What: Register one dual-auth MCP tool set with structured outputs and OAuth challenges.
// Why:  Local clients keep API-key access while the canonical remote server uses account-scoped OAuth.
// Date: 2026-10-12
// Related: [AT-2237] backend→api/public_api_views.py:_authenticate_public_api_request,
//          remote→server/oauth.js:introspectAccessToken
// ─────────────────────────────────────────────────────
export function registerUpvoteClubTools(server, config = {}, options = {}) {
  const skipTools = new Set(options.skipTools || []);
  const apiUrl = (config.apiUrl || process.env.UPVOTE_API_URL || DEFAULT_API_URL).replace(/\/+$/, "");
  const apiKey = config.apiKey ?? process.env.UPVOTE_API_KEY ?? "";
  const logPrefix = config.logPrefix || "[upvote-mcp]";
  const oauthResourceMetadataUrl =
    config.oauthResourceMetadataUrl ||
    process.env.MCP_OAUTH_RESOURCE_METADATA_URL ||
    DEFAULT_OAUTH_RESOURCE_METADATA_URL;
  const serviceAuth = config.serviceAuth || null;
  const serviceScopes = new Set(
    Array.isArray(serviceAuth?.scopes)
      ? serviceAuth.scopes
      : String(serviceAuth?.scopes || "")
          .split(/\s+/)
          .filter(Boolean),
  );

  async function apiRequest(method, path, body = null) {
    const headers = { "Content-Type": "application/json" };

    if (!apiKey && !serviceAuth) {
      console.error(`${logPrefix} apiRequest aborted: no authenticated principal`);
      return {
        ok: false,
        status: 0,
        data: {
          success: false,
          error:
            "Authentication is required. Connect your Upvote.club account or configure UPVOTE_API_KEY.",
        },
      };
    }
    if (apiKey) {
      headers["X-API-Key"] = apiKey;
    } else {
      headers["X-MCP-Internal-Secret"] = serviceAuth.internalSecret;
      headers["X-MCP-User-ID"] = String(serviceAuth.userId);
      headers["X-MCP-OAuth-Scopes"] = [...serviceScopes].join(" ");
    }

    const url = `${apiUrl}${path}`;
    console.error(`${logPrefix} API request: ${method} ${url} body=${body ? JSON.stringify(body) : "none"}`);

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

  function toolResult(payload, isError = false, meta = null) {
    const result = {
      content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
      structuredContent: payload,
      isError,
    };
    if (meta) {
      result._meta = meta;
    }
    return result;
  }

  function authorizationError(requiredScope) {
    const hasServicePrincipal = Boolean(serviceAuth?.userId);
    const error = hasServicePrincipal ? "insufficient_scope" : "invalid_token";
    const description = hasServicePrincipal
      ? `The connected account did not grant ${requiredScope}.`
      : "Connect an Upvote.club account to continue.";
    const challenge =
      `Bearer resource_metadata="${oauthResourceMetadataUrl}", ` +
      `error="${error}", error_description="${description}", ` +
      `scope="${requiredScope}"`;
    console.error(
      `${logPrefix} Authorization rejected: scope=${requiredScope} reason=${error}`,
    );
    return toolResult(
      {
        success: false,
        error: description,
        required_scope: requiredScope,
      },
      true,
      { "mcp/www_authenticate": [challenge] },
    );
  }

  function requireAuthorization(requiredScope) {
    if (apiKey) {
      return null;
    }
    if (
      serviceAuth?.userId &&
      serviceAuth?.internalSecret &&
      serviceScopes.has(requiredScope)
    ) {
      return null;
    }
    return authorizationError(requiredScope);
  }

  server.registerTool(
    "list_platforms",
    {
      title: "List Supported Platforms",
      description:
        "List all social platforms supported by Upvote.club with their available promotion actions, minimum price per action (in points), and example URLs. Call this first if you are unsure which platform or action applies to the link the user wants to promote.",
      inputSchema: {},
      outputSchema: listPlatformsOutputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
      },
      _meta: toolSecurityMeta(TASK_READ_SECURITY_SCHEMES),
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
        minPricesByAction: MIN_PRICES,
        pricingRules: API_REFERENCE.pricingRules,
        billing: API_REFERENCE.billing,
        notes: [
          "Prices are in Upvote.club points, charged per completed action.",
          `COMMENT + meaningful_comment: min ${MEANINGFUL_COMMENT_MIN_PRICE} pts/action.`,
          `GitHub & Product Hunt: min ${HIGH_MIN_PRICE_NETWORKS.GITHUB} pts/action.`,
          "MATE plan + balance + daily task slot required for create_task.",
          "Call get_api_reference for full examples and error catalog.",
        ],
      });
    }
  );

  server.registerTool(
    "get_api_reference",
    {
      title: "Get API Reference",
      description:
        "Full Upvote.club Public API reference for MCP: all tool inputs/outputs, request examples (single-action, MULTI_ACTION, meaningful comments), minimum prices per platform/action, billing rules, and complete error catalog. Call before create_task if unsure about fields or pricing.",
      inputSchema: {},
      outputSchema: apiReferenceOutputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
      },
      _meta: toolSecurityMeta(TASK_READ_SECURITY_SCHEMES),
    },
    async () => {
      console.error(`${logPrefix} Tool call: get_api_reference`);
      return toolResult({ success: true, reference: API_REFERENCE });
    }
  );

  const meaningfulCommentsSchema = z
    .array(z.object({ text: z.string().trim().min(1).describe("Comment text executors must post (no links allowed)") }))
    .min(1)
    .describe("One non-empty comment per requested meaningful COMMENT action; links are not allowed");

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
        "Create a promotion task on Upvote.club. SPENDS points (price × actions_required, plan discount) and 1 daily slot. Call get_api_reference for examples and errors. Auto-detects platform from URL when social_network_code omitted. GitHub/Product Hunt min 16 pts/action; meaningful COMMENT min 64 pts/action.",
      inputSchema: {
        post_url: z.string().url().describe("URL of the post, profile, repo or product to promote"),
        type: z.enum([...ALL_ACTION_TYPES, "MULTI_ACTION"]).describe("Action type or MULTI_ACTION for bundles"),
        price: z.number().int().min(2).optional().describe("Price per action in points (single-action tasks). See list_platforms for minimums."),
        actions_required: z.number().int().min(1).optional().describe("Number of actions (single-action tasks)"),
        social_network_code: z.enum(SOCIAL_NETWORKS.map((n) => n.code)).optional(),
        is_pinned: z.boolean().optional().describe("Pin task to top of executor feed (default false)"),
        meaningful_comment: z.boolean().optional().describe("COMMENT only: executors post exact meaningful_comments text (min 64 pts/action)"),
        meaningful_comments: meaningfulCommentsSchema.optional(),
        long_comment: z
          .boolean()
          .optional()
          .describe(
            "COMMENT only: use unique long comments from the Upvote.club bank. Defaults true for eligible COMMENT tasks when omitted; incompatible with meaningful_comment.",
          ),
        multi_action_items: z.array(multiActionItemSchema).min(2).optional(),
      },
      outputSchema: publicApiOutputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: true,
      },
      _meta: toolSecurityMeta(TASK_WRITE_SECURITY_SCHEMES, {
        "openai/toolInvocation/invoking": "Creating promotion task…",
        "openai/toolInvocation/invoked": "Promotion task created",
      }),
    },
    async (args) => {
      console.error(`${logPrefix} Tool call: create_task args=${JSON.stringify(args)}`);
      const authorizationFailure = requireAuthorization("tasks:write");
      if (authorizationFailure) {
        return authorizationFailure;
      }

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
        if (!Array.isArray(args.multi_action_items) || args.multi_action_items.length < 2) {
          return toolResult(
            {
              success: false,
              error: "multi_action_items must contain at least two actions when type is MULTI_ACTION.",
            },
            true,
          );
        }
        const seenActions = new Set();
        for (const item of args.multi_action_items || []) {
          if (seenActions.has(item.action_type)) {
            return toolResult(
              {
                success: false,
                error: `Duplicate action type in multi_action_items: ${item.action_type}.`,
              },
              true,
            );
          }
          seenActions.add(item.action_type);
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
          if (item.meaningful_comment) {
            const commentCount = (item.meaningful_comments || []).filter(
              (comment) => comment.text.trim().length > 0,
            ).length;
            if (commentCount < item.actions_required) {
              return toolResult(
                {
                  success: false,
                  error:
                    `meaningful_comments for ${item.action_type} must contain at least ` +
                    `${item.actions_required} non-empty comments (got ${commentCount}).`,
                },
                true,
              );
            }
          }
        }
        const commentItem = args.multi_action_items.find(
          (item) => item.action_type === "COMMENT",
        );
        if (args.long_comment && !commentItem) {
          return toolResult(
            {
              success: false,
              error: "long_comment requires a COMMENT item in multi_action_items.",
            },
            true,
          );
        }
        if (args.long_comment && commentItem?.meaningful_comment) {
          return toolResult(
            {
              success: false,
              error: "long_comment and meaningful_comment cannot be enabled together.",
            },
            true,
          );
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
        if (args.meaningful_comment) {
          const commentCount = args.meaningful_comments.filter(
            (comment) => comment.text.trim().length > 0,
          ).length;
          if (commentCount < args.actions_required) {
            return toolResult(
              {
                success: false,
                error:
                  `meaningful_comments must contain at least ${args.actions_required} ` +
                  `non-empty comments (got ${commentCount}).`,
              },
              true,
            );
          }
        }
        if (args.long_comment && args.type !== "COMMENT") {
          return toolResult(
            {
              success: false,
              error: "long_comment is only supported for COMMENT tasks.",
            },
            true,
          );
        }
        if (args.long_comment && args.meaningful_comment) {
          return toolResult(
            {
              success: false,
              error: "long_comment and meaningful_comment cannot be enabled together.",
            },
            true,
          );
        }
      }

      const payload = {
        post_url: args.post_url,
        type: isMulti ? "MULTI_ACTION" : args.type,
        social_network_code: networkCode,
      };
      if (args.is_pinned !== undefined) {
        payload.is_pinned = args.is_pinned;
      }
      if (args.long_comment !== undefined) {
        payload.long_comment = args.long_comment;
      }
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

      // ─── Ariadne's Thread [AT-1029] ─────────────────────
      // What: Prefer backend dashboard_url; fallback to real My Tasks tab route
      // Why:  /dashboard/my-tasks 404; source of truth is public-api create-task response
      // Date: 2026-08-06
      // Related: [AT-1032] backend→api/public_api_views.py:create_task_via_api, front→Dashboard.tsx
      // ─────────────────────────────────────────────────────
      return toolResult({
        ...data,
        dashboard_url:
          data.dashboard_url || "https://upvote.club/dashboard?tab=mytasks",
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
      outputSchema: publicApiOutputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
      },
      _meta: toolSecurityMeta(TASK_READ_SECURITY_SCHEMES, {
        "openai/toolInvocation/invoking": "Loading task progress…",
        "openai/toolInvocation/invoked": "Task progress ready",
      }),
    },
    async (args) => {
      console.error(`${logPrefix} Tool call: get_task_status task_ids=${args.task_ids.join(",")}`);
      const authorizationFailure = requireAuthorization("tasks:read");
      if (authorizationFailure) {
        return authorizationFailure;
      }
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
      outputSchema: publicApiOutputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
      _meta: toolSecurityMeta(TASK_WRITE_SECURITY_SCHEMES, {
        "openai/toolInvocation/invoking": "Deleting promotion task…",
        "openai/toolInvocation/invoked": "Promotion task deleted",
      }),
    },
    async (args) => {
      console.error(`${logPrefix} Tool call: delete_task task_id=${args.task_id}`);
      const authorizationFailure = requireAuthorization("tasks:write");
      if (authorizationFailure) {
        return authorizationFailure;
      }
      const { ok, status, data } = await apiRequest("DELETE", `/api/public-api/delete-task/${args.task_id}/`);
      if (!ok) {
        return toolResult({ success: false, http_status: status, ...data }, true);
      }
      return toolResult(data);
    }
  );
  }

  return {
    apiRequest,
    toolResult,
    requireAuthorization,
    logPrefix,
    apiUrl,
    apiKey,
    serviceAuth,
  };
}

export function createUpvoteClubServer(config = {}, options = {}) {
  const logPrefix = config.logPrefix || "[upvote-mcp]";
  console.error(`${logPrefix} createUpvoteClubServer starting`);

  const server = new McpServer({
    name: "upvote-club",
    version: "2.0.0",
  }, {
    instructions:
      "Use list_platforms before creating a task when the platform or action is uncertain. " +
      "Before create_task, confirm the URL, action, quantity, price per action, and that points will be spent. " +
      "Use delete_task only after explicit user confirmation.",
  });

  registerUpvoteClubTools(server, config, options);
  return server;
}

export { DEFAULT_API_URL };
