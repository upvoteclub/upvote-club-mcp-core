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

export const API_REFERENCE = {
  baseUrl: "https://api.upvote.club/api/public-api/",
  authentication: {
    apiKey: {
      header: "X-API-Key",
      queryParam: "api_key",
      format: "upv_<token>",
      usedBy: ["create_task", "get_task_status", "delete_task"],
      generateAt: "https://upvote.club/api",
      requiresPlan: "MATE",
    },
    jwt: {
      header: "Authorization: Bearer <firebase_access_token>",
      envVar: "UPVOTE_JWT",
      usedBy: ["list_api_keys", "generate_api_key"],
    },
  },
  billing: {
    currency: "Upvote.club points",
    chargeModel: "price × actions_required per action type (plan discount applied on create)",
    dailyTaskSlot: "Each create_task consumes 1 available_tasks slot",
    refundOnDelete: "delete_task refunds points for incomplete actions and restores 1 slot",
    matePlanRequired: "API access requires MATE plan (403 if MEMBER/BUDDY/FREE without upgrade)",
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
      description: "Returns platform catalog with actions and minimum prices. No auth required.",
      input: {},
      outputExample: { success: true, platforms: [{ code: "REDDIT", name: "Reddit", availableActions: [] }] },
    },
    get_api_reference: {
      description: "Returns this full reference document (examples, errors, pricing). No auth required.",
      input: {},
    },
    list_api_keys: {
      description: "List active API key metadata (hash preview only, not the secret).",
      auth: "JWT",
      http: "GET /api/public-api/list-keys/",
      input: {},
      successExample: {
        success: true,
        keys: [
          {
            id: 1,
            name: "",
            key_preview: "a1b2c3d4...ef12",
            is_active: true,
            is_expired: false,
            created_at: "2024-12-25T10:30:00Z",
            last_used_at: "2024-12-26T08:00:00Z",
            expires_at: null,
          },
        ],
        count: 1,
      },
      errors: [
        { status: 401, error: "Authentication required. Please provide a valid JWT token in Authorization header." },
      ],
    },
    generate_api_key: {
      description: "Generate new API key. Shown once. Deactivates previous active key.",
      auth: "JWT + MATE plan",
      http: "POST /api/public-api/generate-key/",
      input: { name: "optional string label" },
      successExample: {
        success: true,
        api_key: "upv_xxxxxxxx",
        key_id: 1,
        name: "",
        created_at: "2024-12-25T10:30:00Z",
        message: "API key generated successfully. Save this key securely - it will not be shown again.",
        previous_key_deactivated: true,
      },
      errors: [
        { status: 401, error: "Authentication required. Please provide a valid JWT token." },
        { status: 403, error: "API access requires MATE plan. Please upgrade your account." },
      ],
    },
    create_task: {
      description: "Create promotion task. Spends points and 1 daily slot immediately.",
      auth: "X-API-Key + MATE plan",
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
          actions_required: 5,
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
              actions_required: 2,
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
      },
      errors: [
        { status: 401, error: "Invalid or missing API key. Provide X-API-Key header or api_key parameter." },
        { status: 403, error: "API access requires MATE plan. Please upgrade your account." },
        {
          status: 403,
          error: "Profile verification required. Please verify your social profile before creating tasks.",
          needs_verification: true,
          social_network_code: "REDDIT",
          note: "FREE non-tier1 users with free task slots must verify social profile on the target network",
        },
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
        { status: 400, error: "Comment text must not contain links" },
        { status: 400, error: "multi_action_items must be a list with at least two actions" },
        { status: 400, error: "Action type X is not available for Network Name" },
      ],
    },
    get_task_status: {
      description: "Track progress for one or more tasks you created.",
      auth: "X-API-Key",
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
      auth: "X-API-Key",
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
