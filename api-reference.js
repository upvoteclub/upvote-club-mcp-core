// ─── Ariadne's Thread [AT-0540] ─────────────────────
// What: Full Public API reference for MCP — fields, prices, examples, errors (synced with apiDocumentation.json)
// Why:  Claude/clients need explicit request shapes, minimum prices, and error catalog without guessing
// Date: 2026-07-14
// Related: frontend→src/data/apiDocumentation.json, backend→api/public_api_views.py
// ─────────────────────────────────────────────────────
import {
  MIN_PRICES,
  HIGH_MIN_PRICE_NETWORKS,
  MEANINGFUL_COMMENT_MIN_PRICE,
  SOCIAL_NETWORKS,
} from "./platforms.js";

// ─── Ariadne's Thread [AT-2245] ─────────────────────
// What: Document dual API-key/OAuth authentication and every current create-task field.
// Why:  Universal MCP clients must use the same paid-plan rules and payload contract as production.
// Date: 2026-10-12
// Related: [AT-2244] core→create-server.js:registerUpvoteClubTools,
//          [AT-2230] backend→api/mcp_oauth_views.py
// ─────────────────────────────────────────────────────
export const API_REFERENCE = {
  baseUrl: "https://api.upvote.club/api/public-api/",
  setup: {
    steps: [
      "1. Register at https://upvote.club",
      "2. Activate the MEMBER or MATE plan (API access is included)",
      "3. Remote MCP: connect your Upvote.club account with OAuth when your MCP client prompts",
      "4. Local MCP: generate an API key at https://upvote.club/api and set UPVOTE_API_KEY",
    ],
    apiKeyUrl: "https://upvote.club/api",
    signupUrl: "https://upvote.club",
    header: "X-API-Key",
    envVar: "UPVOTE_API_KEY",
    format: "upv_<token>",
  },
  authentication: {
    description:
      "Remote MCP (https://mcp.upvote.club/mcp) requires credentials on every request: OAuth 2.1 account connection or an X-API-Key header. Local/stdio MCP uses an API key from https://upvote.club/api.",
    remote: "OAuth 2.1 authorization code with PKCE, or X-API-Key header",
    localHeader: "X-API-Key",
    localEnvVar: "UPVOTE_API_KEY",
  },
  billing: {
    currency: "Upvote.club points",
    chargeModel: "price × actions_required per action type (plan discount applied on create)",
    dailyTaskSlot: "Each create_task consumes 1 available_tasks slot",
    refundOnDelete: "delete_task refunds points for incomplete actions and restores 1 slot",
    paidPlanRequired: "API access requires an active MEMBER or MATE plan",
  },
  pricingRules: {
    globalMinimumPerAction: 2,
    minPricesByAction: MIN_PRICES,
    highMinimumNetworks: {
      GITHUB: { minPerAction: HIGH_MIN_PRICE_NETWORKS.GITHUB, appliesTo: "all actions on GitHub" },
      PRODUCTHUNT: { minPerAction: HIGH_MIN_PRICE_NETWORKS.PRODUCTHUNT, appliesTo: "all actions on Product Hunt" },
    },
    meaningfulComment: {
      minPerAction: MEANINGFUL_COMMENT_MIN_PRICE,
      appliesTo: "COMMENT actions with meaningful_comment: true",
      requires: "meaningful_comments: [{ text: '...' }] — no links in comment text",
    },
    formula: "total_cost ≈ sum(price × actions_required) × (1 - plan_discount). MCP validates floors before calling API.",
  },
  platforms: SOCIAL_NETWORKS.map((n) => ({
    code: n.code,
    name: n.name,
    availableActions: n.availableActions,
    postUrlExample: n.postUrlExample,
    profileUrlExample: n.profileUrlExample,
    domains: n.domains,
    minPricePerAction: Object.fromEntries(
      n.availableActions.map((a) => [a, Math.max(MIN_PRICES[a] || 2, HIGH_MIN_PRICE_NETWORKS[n.code] || 0, 2)])
    ),
  })),
  tools: {
    list_platforms: {
      description: "Returns platform catalog with actions and minimum prices. Does not call the Public API; remote MCP still requires OAuth or X-API-Key to connect.",
      input: {},
      outputExample: { success: true, platforms: [{ code: "REDDIT", name: "Reddit", availableActions: [] }] },
    },
    get_api_reference: {
      description: "Returns this full reference document (examples, errors, pricing). Does not call the Public API; remote MCP still requires OAuth or X-API-Key to connect.",
      input: {},
    },
    create_task: {
      description: "Create promotion task. Spends points and 1 daily slot immediately.",
      auth: "OAuth 2.1 or X-API-Key + active MEMBER/MATE plan",
      http: "POST /api/public-api/create-task/",
      inputFields: {
        post_url: { type: "string (URL)", required: true, description: "Post, profile, repo or product URL to promote" },
        type: {
          type: "string",
          required: true,
          description: "Action code (LIKE, UPVOTE, COMMENT, …) or MULTI_ACTION for bundles",
        },
        social_network_code: {
          type: "string",
          required: true,
          description: "TWITTER, REDDIT, QUORA, … — auto-detected from post_url in MCP if omitted",
        },
        price: { type: "integer", required: "single-action only", min: 2, description: "Points per completed action" },
        actions_required: { type: "integer", required: "single-action only", min: 1, description: "How many actions to order" },
        is_pinned: { type: "boolean", optional: true, default: false, description: "Pin task to top of executor feed" },
        meaningful_comment: {
          type: "boolean",
          optional: true,
          description: "COMMENT only — executors must post exact text from meaningful_comments (min 64 pts/action)",
        },
        meaningful_comments: {
          type: "array",
          required: "when meaningful_comment is true",
          format: '[{ "text": "Your comment without links" }]',
          rules: ["Provide at least one non-empty comment per actions_required slot"],
        },
        long_comment: {
          type: "boolean",
          optional: true,
          default: "true for eligible COMMENT tasks",
          description:
            "Use unique comments from the Upvote.club long-comment bank; incompatible with meaningful_comment",
        },
        multi_action_items: {
          type: "array",
          required: "when type is MULTI_ACTION (min 2 items)",
          format:
            '[{ "action_type": "LIKE", "price": 2, "actions_required": 10 }, { "action_type": "COMMENT", "price": 64, "actions_required": 1, "meaningful_comment": true, "meaningful_comments": [{ "text": "Great post!" }] }]',
          rules: ["Each action_type unique within bundle", "Each action must be allowed on social_network_code"],
        },
      },
      examples: {
        redditUpvotes: {
          post_url: "https://www.reddit.com/r/startups/comments/abc123/my_launch/",
          type: "UPVOTE",
          social_network_code: "REDDIT",
          price: 4,
          actions_required: 20,
        },
        productHuntLaunch: {
          post_url: "https://www.producthunt.com/posts/my-product",
          type: "UPVOTE",
          social_network_code: "PRODUCTHUNT",
          price: 16,
          actions_required: 50,
          note: "Product Hunt minimum is 16 points per action",
        },
        meaningfulComment: {
          post_url: "https://www.reddit.com/r/SaaS/comments/xyz/post/",
          type: "COMMENT",
          social_network_code: "REDDIT",
          price: 64,
          actions_required: 1,
          meaningful_comment: true,
          meaningful_comments: [{ text: "Really helpful breakdown, saved this for later." }],
        },
        multiActionBundle: {
          post_url: "https://twitter.com/user/status/123456789",
          type: "MULTI_ACTION",
          social_network_code: "TWITTER",
          multi_action_items: [
            { action_type: "LIKE", price: 2, actions_required: 10 },
            {
              action_type: "COMMENT",
              price: 64,
              actions_required: 1,
              meaningful_comment: true,
              meaningful_comments: [{ text: "Solid thread, thanks for sharing." }],
            },
          ],
        },
        githubStars: {
          post_url: "https://github.com/org/repo",
          type: "STAR",
          social_network_code: "GITHUB",
          price: 16,
          actions_required: 30,
          note: "GitHub minimum is 16 points per action",
        },
      },
      successExample: {
        success: true,
        task_id: 12345,
        message: "Task created successfully",
        task: {
          id: 12345,
          status: "ACTIVE",
          post_url: "https://twitter.com/username/status/123456789",
          type: "LIKE",
          social_network_code: "TWITTER",
          actions_required: 10,
          actions_completed: 0,
          price: 2,
          original_price: 20,
        },
        // ─── Ariadne's Thread [AT-1033] ─────────────────────
        // What: Document create_task dashboard_url pointing at My Tasks tab
        // Why:  Old /dashboard/my-tasks path 404s; matches backend public-api response
        // Date: 2026-08-06
        // Related: [AT-1032] backend→api/public_api_views.py:create_task_via_api
        // ─────────────────────────────────────────────────────
        dashboard_url: "https://upvote.club/dashboard?tab=mytasks",
      },
      errors: [
        { status: 401, error: "Invalid or missing API key. Provide X-API-Key header or api_key parameter." },
        { status: 403, error: "API access requires MEMBER or MATE plan. Please upgrade your account." },
        { status: 400, error: "Missing required fields: post_url, type, price, actions_required, social_network_code" },
        { status: 400, error: "Minimum price per action is 2 points" },
        { status: 400, error: "No available tasks left. Please purchase more tasks." },
        {
          status: 400,
          error: "Insufficient balance to create task",
          required_balance: 100,
          current_balance: 50,
        },
        {
          status: 400,
          error: "A task with this URL already exists and is being completed by our community",
          existing_task_id: 12344,
          note: "One active task per normalized URL + type + platform",
        },
        {
          status: 400,
          error: "meaningful_comments is required when meaningful_comment is enabled. Format: [{\"text\": \"comment text\"}]",
        },
        {
          status: 400,
          error: "meaningful_comments must contain at least N non-empty comments to cover actions_required",
        },
        { status: 400, error: "long_comment and meaningful_comment cannot be enabled together" },
        { status: 400, error: "Comment text must not contain links" },
        { status: 400, error: "multi_action_items must be a list with at least two actions" },
        { status: 400, error: "Action type X is not available for Network Name" },
      ],
    },
    get_task_status: {
      description: "Track progress for one or more tasks you created.",
      auth: "OAuth 2.1 or X-API-Key",
      http: "GET /api/public-api/task-status/?task_ids=123,124",
      input: { task_ids: [123, 124] },
      successExample: {
        success: true,
        count: 1,
        tasks: [
          {
            id: 12345,
            status: "ACTIVE",
            type: "LIKE",
            post_url: "https://twitter.com/username/status/123456789",
            actions_required: 10,
            actions_completed: 7,
            progress_percentage: 70,
            remaining_actions: 3,
            meaningful_comment: false,
            action_completions: [],
          },
        ],
      },
      meaningfulCommentFields: {
        meaningful_comment: true,
        meaningful_comments: [{ text: "..." }],
        answer_url: "URL of published answer when available",
        action_completions: [
          {
            id: 90001,
            completed_at: "2024-12-25T11:05:00Z",
            submitted_comment: "text posted",
            comment_url: "https://...",
            answer_url: "https://...",
          },
        ],
      },
      errors: [
        { status: 401, error: "Invalid or missing API key." },
        { status: 404, error: "Tasks not found or you do not have permission to view them" },
        { status: 400, error: "task_id or task_ids parameter is required" },
      ],
    },
    delete_task: {
      description: "Delete incomplete task. Refunds unused points, restores daily slot.",
      auth: "OAuth 2.1 or X-API-Key",
      http: "DELETE /api/public-api/delete-task/{task_id}/",
      input: { task_id: 12345 },
      successExample: {
        success: true,
        refunded_points: 80,
        new_balance: 1200,
        new_available_tasks: 3,
        task_id: 12345,
        task_status: "DELETED",
        message: "Task deleted successfully.",
      },
      errors: [
        { status: 401, error: "Invalid or missing API key." },
        { status: 404, error: "Task not found or you do not have permission to delete it." },
        { status: 400, error: "Task is already completed and cannot be deleted." },
      ],
    },
  },
  workflowForClaude: [
    "0. Remote clients connect with OAuth; local clients use an API key from https://upvote.club/api. MEMBER or MATE is required.",
    "1. Call get_api_reference or list_platforms before first create_task in a session.",
    "2. Detect social_network_code from URL or ask user.",
    "3. Pick action type allowed on that platform; check min price (16 for GitHub/Product Hunt, 64 for meaningful COMMENT).",
    "4. Confirm price × quantity and daily slot spend with user.",
    "5. create_task → save task_id.",
    "6. get_task_status to poll progress.",
    "7. delete_task only if user confirms cancel (destructive).",
  ],
};

export function getApiReferenceText() {
  return JSON.stringify(API_REFERENCE, null, 2);
}
