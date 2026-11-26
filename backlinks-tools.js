// ─── Ariadne's Thread [AT-3850] ─────────────────────
// What: MCP tools for Directory Submissions and Forum Backlinks: create a project, read the
//       directories/forums table, submit or place on chosen IDs, read statuses.
// Why:  Owner: agents must create these the same way as promotion tasks.
// Date: 2026-11-26
// Related: backend→api/public_api_backlinks_views.py,
//          backend→api/urls.py:public-api/directory-submissions, public-api/forum-backlinks
// ─────────────────────────────────────────────────────
import { z } from "zod";

const READ_SCHEMES = [{ type: "oauth2", scopes: ["tasks:read"] }];
const WRITE_SCHEMES = [{ type: "oauth2", scopes: ["tasks:write"] }];
const MAX_IDS_PER_CALL = 10;

const outputSchema = z.object({ success: z.boolean() }).passthrough();

const projectIdSchema = z
  .number()
  .int()
  .positive()
  .describe("Project ID from the create or list tool");

const onlyAvailableSchema = z
  .boolean()
  .optional()
  .describe("true: return only rows that can still be used (can_submit / can_place)");

const LANGUAGES = [
  "ENGLISH",
  "SPANISH",
  "GERMAN",
  "FRENCH",
  "PORTUGUESE",
  "ITALIAN",
  "DUTCH",
  "POLISH",
  "JAPANESE",
  "VIETNAMESE",
  "RUSSIAN",
];

function readAnnotations() {
  return { readOnlyHint: true, destructiveHint: false, openWorldHint: false };
}

function writeAnnotations() {
  return { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true };
}

function meta(schemes, invoking, invoked) {
  return {
    securitySchemes: schemes,
    "openai/toolInvocation/invoking": invoking,
    "openai/toolInvocation/invoked": invoked,
  };
}

function filterRows(data, key, flag, onlyAvailable) {
  if (!onlyAvailable || !data || !Array.isArray(data[key])) {
    return data;
  }
  const rows = data[key].filter((row) => row && row[flag]);
  return { ...data, [key]: rows, [`${key}_shown`]: rows.length };
}

/**
 * @param {import("@modelcontextprotocol/sdk/server/mcp.js").McpServer} server
 * @param {{ apiRequest: Function, toolResult: Function, requireAuthorization: Function, logPrefix: string }} helpers
 * @param {Set<string>} skipTools
 */
export function registerBacklinksTools(server, helpers, skipTools = new Set()) {
  const { apiRequest, toolResult, requireAuthorization, logPrefix } = helpers;

  async function call(scope, method, path, body = null, transform = null) {
    const authorizationFailure = requireAuthorization(scope);
    if (authorizationFailure) {
      return authorizationFailure;
    }
    const { ok, status, data } = await apiRequest(method, path, body);
    if (!ok) {
      return toolResult({ success: false, http_status: status, ...data }, true);
    }
    return toolResult(transform ? transform(data) : data);
  }

  function register(name, config, handler) {
    if (skipTools.has(name)) {
      return;
    }
    server.registerTool(name, { outputSchema, ...config }, async (args = {}) => {
      console.error(`${logPrefix} Tool call: ${name} args=${JSON.stringify(args)}`);
      return handler(args);
    });
  }

  const dirBase = "/api/public-api/directory-submissions/projects/";
  const forumBase = "/api/public-api/forum-backlinks/projects/";

  // ─── Directory Submissions ──────────────────────────────────────────────

  register(
    "create_directory_project",
    {
      title: "Create Directory Submissions Project",
      description:
        "Create (or reopen) a Directory Submissions project for the user's site and get the table of directories: each row has id, name, domain_rating, price_points, status (available, in_progress, completed, rejected, unavailable) and can_submit. " +
        "The product card (title, description, favicon_url, thumbnail_url, categories) is what directories show and is needed before submitting; send all five together. Calling it again with the same domain updates the card. " +
        "auto_publish_enabled turns daily submissions (one new directory a day while points cover it) on or off. No points are spent by this tool.",
      inputSchema: {
        domain: z.string().trim().min(3).describe("Site domain or URL, e.g. example.com"),
        title: z.string().trim().min(1).max(140).optional().describe("Product name"),
        description: z.string().trim().min(1).max(200).optional().describe("Short product description"),
        favicon_url: z.string().url().optional().describe("Public URL of the logo or favicon"),
        thumbnail_url: z.string().url().optional().describe("Public URL of a cover image or screenshot"),
        categories: z
          .array(z.string().trim().min(1).max(50))
          .min(1)
          .max(20)
          .optional()
          .describe("1–20 product categories, e.g. [\"SaaS\", \"Marketing\"]"),
        extra_info: z.string().optional().describe("Anything else directories should know"),
        auto_publish_enabled: z
          .boolean()
          .optional()
          .describe("Daily submissions on (true) or off (false)"),
        only_available: onlyAvailableSchema,
      },
      annotations: writeAnnotations(),
      _meta: meta(WRITE_SCHEMES, "Setting up the project…", "Project ready"),
    },
    async ({ only_available, ...body }) =>
      call("tasks:write", "POST", dirBase, body, (data) =>
        filterRows(data, "directories", "can_submit", only_available),
      ),
  );

  register(
    "list_directory_projects",
    {
      title: "List Directory Submissions Projects",
      description:
        "List the user's Directory Submissions projects with in_progress_count, completed_count and whether the product card is ready (ready_to_submit, missing_fields).",
      inputSchema: {},
      annotations: readAnnotations(),
      _meta: meta(READ_SCHEMES, "Loading projects…", "Projects ready"),
    },
    async () => call("tasks:read", "GET", dirBase),
  );

  register(
    "get_directory_project",
    {
      title: "Get Directories",
      description:
        "Get a Directory Submissions project and its directories table with the current status of every directory for this project (available, in_progress, completed with placement_url, rejected with reject_reason, unavailable). Use it to pick directory IDs and to track progress.",
      inputSchema: {
        project_id: projectIdSchema,
        only_available: onlyAvailableSchema,
      },
      annotations: readAnnotations(),
      _meta: meta(READ_SCHEMES, "Loading directories…", "Directories ready"),
    },
    async ({ project_id, only_available }) =>
      call("tasks:read", "GET", `${dirBase}${project_id}/`, null, (data) =>
        filterRows(data, "directories", "can_submit", only_available),
      ),
  );

  register(
    "submit_to_directories",
    {
      title: "Submit to Directories",
      description:
        `Submit the user's site to the chosen directories (up to ${MAX_IDS_PER_CALL} IDs per call; call again for more). Spends each directory's price_points from the balance while it covers it. ` +
        "Every ID gets its own result: submitted, already_submitted (no charge), insufficient_balance (with need and balance), rejected, not_found, invalid or error. " +
        "Confirm the directories and the total points with the user before calling.",
      inputSchema: {
        project_id: projectIdSchema,
        directory_ids: z
          .array(z.number().int().positive())
          .min(1)
          .max(MAX_IDS_PER_CALL)
          .describe("Directory IDs from the directories table (can_submit: true)"),
      },
      annotations: writeAnnotations(),
      _meta: meta(WRITE_SCHEMES, "Submitting to directories…", "Submissions sent"),
    },
    async ({ project_id, directory_ids }) =>
      call("tasks:write", "POST", `${dirBase}${project_id}/submit/`, { directory_ids }),
  );

  register(
    "get_directory_submissions",
    {
      title: "Get Directory Submissions",
      description:
        "List every submission of a Directory Submissions project, newest first: in_progress, completed (placement_url is the live listing) or rejected (reject_reason, points_refunded).",
      inputSchema: { project_id: projectIdSchema },
      annotations: readAnnotations(),
      _meta: meta(READ_SCHEMES, "Loading submissions…", "Submissions ready"),
    },
    async ({ project_id }) => call("tasks:read", "GET", `${dirBase}${project_id}/submissions/`),
  );

  // ─── Forum Backlinks ────────────────────────────────────────────────────

  register(
    "create_forum_project",
    {
      title: "Create Forum Backlinks Project",
      description:
        "Create (or reopen) a Forum Backlinks project for the user's site and get the table of forums in the project language: each row has id, domain, domain_rating, price_points, status and can_place. " +
        "project.site_status is ready when backlinks can be placed, checking while the site is being checked (try again later), rejected when the site cannot get forum backlinks. No points are spent by this tool.",
      inputSchema: {
        domain: z.string().trim().min(3).describe("Site domain or URL, e.g. example.com"),
        language: z.enum(LANGUAGES).optional().describe("Site and forum language (default ENGLISH)"),
        only_available: onlyAvailableSchema,
      },
      annotations: writeAnnotations(),
      _meta: meta(WRITE_SCHEMES, "Setting up the project…", "Project ready"),
    },
    async ({ only_available, ...body }) =>
      call("tasks:write", "POST", forumBase, body, (data) =>
        filterRows(data, "forums", "can_place", only_available),
      ),
  );

  register(
    "list_forum_projects",
    {
      title: "List Forum Backlinks Projects",
      description:
        "List the user's Forum Backlinks projects with site_status, placements_count and completed_count.",
      inputSchema: {},
      annotations: readAnnotations(),
      _meta: meta(READ_SCHEMES, "Loading projects…", "Projects ready"),
    },
    async () => call("tasks:read", "GET", forumBase),
  );

  register(
    "get_forum_project",
    {
      title: "Get Forums",
      description:
        "Get a Forum Backlinks project and its forums table with the current status of every forum for this project (available, in_progress, completed with placement_url, rejected). Use it to pick forum IDs and to track progress.",
      inputSchema: {
        project_id: projectIdSchema,
        only_available: onlyAvailableSchema,
      },
      annotations: readAnnotations(),
      _meta: meta(READ_SCHEMES, "Loading forums…", "Forums ready"),
    },
    async ({ project_id, only_available }) =>
      call("tasks:read", "GET", `${forumBase}${project_id}/`, null, (data) =>
        filterRows(data, "forums", "can_place", only_available),
      ),
  );

  const placementSchema = z
    .object({
      forum_id: z.number().int().positive().describe("Forum ID from the forums table"),
      keyword: z.string().trim().min(1).describe("Anchor text of the backlink"),
      target_url: z.string().url().describe("Page on the project domain the backlink points to"),
    })
    .strict();

  register(
    "place_forum_backlinks",
    {
      title: "Place Forum Backlinks",
      description:
        `Place backlinks on the chosen forums (up to ${MAX_IDS_PER_CALL} per call). Either forum_ids + keyword + target_url (same anchor everywhere) or placements: [{forum_id, keyword, target_url}]. target_url must be on the project domain. ` +
        "Spends each forum's price_points from the balance while it covers it. Every forum gets its own result: placed, already_placed (no charge), insufficient_balance, site_checking, not_found, invalid or error. " +
        "Confirm the forums, anchor, URL and total points with the user before calling.",
      inputSchema: {
        project_id: projectIdSchema,
        forum_ids: z
          .array(z.number().int().positive())
          .min(1)
          .max(MAX_IDS_PER_CALL)
          .optional()
          .describe("Forum IDs (can_place: true), used with keyword and target_url"),
        keyword: z.string().trim().min(1).optional().describe("Anchor text for every forum in forum_ids"),
        target_url: z.string().url().optional().describe("Target page for every forum in forum_ids"),
        placements: z
          .array(placementSchema)
          .min(1)
          .max(MAX_IDS_PER_CALL)
          .optional()
          .describe("Per-forum anchors instead of forum_ids + keyword + target_url"),
      },
      annotations: writeAnnotations(),
      _meta: meta(WRITE_SCHEMES, "Placing forum backlinks…", "Placements sent"),
    },
    async ({ project_id, forum_ids, keyword, target_url, placements }) => {
      let body;
      if (placements && placements.length > 0) {
        body = { placements };
      } else if (forum_ids && forum_ids.length > 0 && keyword && target_url) {
        body = { forum_ids, keyword, target_url };
      } else {
        return toolResult(
          {
            success: false,
            error: "Send placements, or forum_ids together with keyword and target_url.",
          },
          true,
        );
      }
      return call("tasks:write", "POST", `${forumBase}${project_id}/place/`, body);
    },
  );

  register(
    "get_forum_placements",
    {
      title: "Get Forum Placements",
      description:
        "List every backlink placement of a Forum Backlinks project, newest first: forum, keyword, target_url, status (in_progress, completed with placement_url, rejected) and points_charged.",
      inputSchema: { project_id: projectIdSchema },
      annotations: readAnnotations(),
      _meta: meta(READ_SCHEMES, "Loading placements…", "Placements ready"),
    },
    async ({ project_id }) => call("tasks:read", "GET", `${forumBase}${project_id}/placements/`),
  );
}

export const BACKLINKS_API_REFERENCE = {
  directorySubmissions: {
    flow: [
      "create_directory_project with domain + product card → directories table.",
      "Pick IDs with can_submit: true; confirm total price_points with the user.",
      `submit_to_directories with up to ${MAX_IDS_PER_CALL} directory_ids → result per ID.`,
      "get_directory_project or get_directory_submissions to track status and placement_url.",
    ],
    endpoints: {
      create_directory_project: "POST /api/public-api/directory-submissions/projects/",
      list_directory_projects: "GET /api/public-api/directory-submissions/projects/",
      get_directory_project: "GET /api/public-api/directory-submissions/projects/{project_id}/",
      submit_to_directories: "POST /api/public-api/directory-submissions/projects/{project_id}/submit/",
      get_directory_submissions: "GET /api/public-api/directory-submissions/projects/{project_id}/submissions/",
    },
    submitResults: [
      "submitted",
      "already_submitted",
      "insufficient_balance",
      "rejected",
      "not_found",
      "invalid",
      "error",
    ],
  },
  forumBacklinks: {
    flow: [
      "create_forum_project with domain (+ language) → forums table; wait until project.site_status is ready.",
      "Pick IDs with can_place: true; confirm anchor, target URL and total price_points with the user.",
      `place_forum_backlinks with up to ${MAX_IDS_PER_CALL} forums → result per forum.`,
      "get_forum_project or get_forum_placements to track status and placement_url.",
    ],
    endpoints: {
      create_forum_project: "POST /api/public-api/forum-backlinks/projects/",
      list_forum_projects: "GET /api/public-api/forum-backlinks/projects/",
      get_forum_project: "GET /api/public-api/forum-backlinks/projects/{project_id}/",
      place_forum_backlinks: "POST /api/public-api/forum-backlinks/projects/{project_id}/place/",
      get_forum_placements: "GET /api/public-api/forum-backlinks/projects/{project_id}/placements/",
    },
    placeResults: [
      "placed",
      "already_placed",
      "insufficient_balance",
      "site_checking",
      "plan_required",
      "not_found",
      "invalid",
      "error",
    ],
  },
};
