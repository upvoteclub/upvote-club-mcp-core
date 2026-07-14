// ─── Ariadne's Thread [AT-0532] ─────────────────────
// What: Static catalog of Upvote.club social networks, actions and minimum prices for the promotion MCP server
// Why:  Single source for list_platforms and client-side validation before create_task API calls
// Date: 2026-07-14
// Related: frontend→src/data/apiDocumentation.json:socialNetworks, backend→api/public_api_views.py:create_task_via_api
// ─────────────────────────────────────────────────────

export const MIN_PRICES = {
  LIKE: 2,
  FOLLOW: 4,
  COMMENT: 4,
  REPOST: 4,
  SAVE: 4,
  STAR: 3,
  WATCH: 2,
  CLAP: 2,
  CONNECT: 4,
  SUBSCRIBE: 4,
  RESTACK: 6,
  UP: 2,
  DOWN: 2,
  UPVOTE: 4,
  DOWNVOTE: 2,
  INSTALL: 10,
  UNICORN: 2,
  FAVORITE: 2,
  BOOST: 4,
  SHARE: 4,
  REPLY: 4,
  REVIEW: 4,
};

export const HIGH_MIN_PRICE_NETWORKS = { GITHUB: 16, PRODUCTHUNT: 16 };
export const MEANINGFUL_COMMENT_MIN_PRICE = 64;

export const SOCIAL_NETWORKS = [
  {
    code: "TWITTER",
    name: "Twitter (X.com)",
    availableActions: ["LIKE", "COMMENT", "REPOST", "FOLLOW", "SAVE"],
    postUrlExample: "https://twitter.com/username/status/123456789",
    profileUrlExample: "https://x.com/username",
    domains: ["twitter.com", "x.com"],
  },
  {
    code: "LINKEDIN",
    name: "LinkedIn",
    availableActions: ["LIKE", "COMMENT", "REPOST", "FOLLOW", "SAVE"],
    postUrlExample: "https://www.linkedin.com/posts/username_post-title-activity-123456789",
    profileUrlExample: "https://www.linkedin.com/in/username",
    domains: ["linkedin.com"],
  },
  {
    code: "REDDIT",
    name: "Reddit",
    availableActions: ["UPVOTE", "COMMENT", "SAVE", "FOLLOW"],
    postUrlExample: "https://www.reddit.com/r/subreddit/comments/123456/post_title",
    profileUrlExample: "https://www.reddit.com/user/username",
    domains: ["reddit.com"],
  },
  {
    code: "INSTAGRAM",
    name: "Instagram",
    availableActions: ["LIKE", "COMMENT", "FOLLOW", "SAVE"],
    postUrlExample: "https://www.instagram.com/p/ABC123xyz/",
    profileUrlExample: "https://www.instagram.com/username/",
    domains: ["instagram.com"],
  },
  {
    code: "TIKTOK",
    name: "TikTok",
    availableActions: ["LIKE", "COMMENT", "FOLLOW", "SAVE"],
    postUrlExample: "https://www.tiktok.com/@username/video/1234567890",
    profileUrlExample: "https://www.tiktok.com/@username",
    domains: ["tiktok.com"],
  },
  {
    code: "YOUTUBE",
    name: "YouTube",
    availableActions: ["LIKE", "COMMENT", "SAVE", "SUBSCRIBE"],
    postUrlExample: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    profileUrlExample: "https://www.youtube.com/@username",
    domains: ["youtube.com", "youtu.be"],
  },
  {
    code: "FACEBOOK",
    name: "Facebook",
    availableActions: ["LIKE", "COMMENT", "REPOST", "FOLLOW", "SAVE"],
    postUrlExample: "https://www.facebook.com/username/posts/123456789",
    profileUrlExample: "https://www.facebook.com/username",
    domains: ["facebook.com"],
  },
  {
    code: "MEDIUM",
    name: "Medium",
    availableActions: ["CLAP", "COMMENT", "FOLLOW", "SAVE"],
    postUrlExample: "https://medium.com/@username/article-title-123456",
    profileUrlExample: "https://medium.com/@username",
    domains: ["medium.com"],
  },
  {
    code: "DEVTO",
    name: "Dev.to",
    availableActions: ["LIKE", "COMMENT", "SAVE", "FOLLOW", "UNICORN"],
    postUrlExample: "https://dev.to/username/article-title-123",
    profileUrlExample: "https://dev.to/username",
    domains: ["dev.to"],
  },
  {
    code: "GITHUB",
    name: "GitHub",
    availableActions: ["STAR", "FOLLOW", "WATCH"],
    postUrlExample: "https://github.com/username/repository",
    profileUrlExample: "https://github.com/username",
    domains: ["github.com"],
  },
  {
    code: "QUORA",
    name: "Quora",
    availableActions: ["UPVOTE", "COMMENT", "FOLLOW", "SHARE"],
    postUrlExample: "https://www.quora.com/question-title",
    profileUrlExample: "https://www.quora.com/profile/username",
    domains: ["quora.com"],
  },
  {
    code: "SUBSTACK",
    name: "Substack",
    availableActions: ["RESTACK", "COMMENT", "SAVE", "FOLLOW"],
    postUrlExample: "https://username.substack.com/p/article-title",
    profileUrlExample: "https://username.substack.com",
    domains: ["substack.com"],
  },
  {
    code: "BLUESKY",
    name: "Bluesky",
    availableActions: ["LIKE", "COMMENT", "REPOST", "FOLLOW"],
    postUrlExample: "https://bsky.app/profile/username.bsky.social/post/123456",
    profileUrlExample: "https://bsky.app/profile/username.bsky.social",
    domains: ["bsky.app"],
  },
  {
    code: "THREADS",
    name: "Threads",
    availableActions: ["LIKE", "COMMENT", "REPOST", "FOLLOW", "SAVE"],
    postUrlExample: "https://www.threads.net/@username/post/123456789",
    profileUrlExample: "https://www.threads.net/@username",
    domains: ["threads.net"],
  },
  {
    code: "MASTODON",
    name: "Mastodon",
    availableActions: ["BOOST", "FAVORITE", "REPLY", "FOLLOW", "SAVE"],
    postUrlExample: "https://mastodon.social/@username/123456789",
    profileUrlExample: "https://mastodon.social/@username",
    domains: ["mastodon.social"],
  },
  {
    code: "PRODUCTHUNT",
    name: "Product Hunt",
    availableActions: ["UPVOTE", "FOLLOW", "COMMENT"],
    postUrlExample: "https://www.producthunt.com/posts/product-name",
    profileUrlExample: "https://www.producthunt.com/@username",
    domains: ["producthunt.com"],
  },
  {
    code: "HACKERNEWS",
    name: "Hacker News",
    availableActions: ["UPVOTE", "COMMENT"],
    postUrlExample: "https://news.ycombinator.com/item?id=123456",
    profileUrlExample: "https://news.ycombinator.com/user?id=username",
    domains: ["news.ycombinator.com", "ycombinator.com"],
  },
  {
    code: "INDIEHACKERS",
    name: "Indie Hackers",
    availableActions: ["UPVOTE", "COMMENT"],
    postUrlExample: "https://www.indiehackers.com/post/post-title-123456",
    profileUrlExample: "https://www.indiehackers.com/username",
    domains: ["indiehackers.com"],
  },
];

export const ALL_ACTION_TYPES = Object.keys(MIN_PRICES);

export function detectNetworkFromUrl(rawUrl) {
  let hostname;
  try {
    hostname = new URL(rawUrl).hostname.toLowerCase();
  } catch (err) {
    console.error(`[upvote-mcp] detectNetworkFromUrl: failed to parse URL "${rawUrl}": ${err.message}`);
    return null;
  }
  for (const network of SOCIAL_NETWORKS) {
    for (const domain of network.domains) {
      if (hostname === domain || hostname.endsWith(`.${domain}`)) {
        console.error(`[upvote-mcp] detectNetworkFromUrl: matched hostname "${hostname}" to network ${network.code}`);
        return network.code;
      }
    }
  }
  console.error(`[upvote-mcp] detectNetworkFromUrl: no network matched for hostname "${hostname}"`);
  return null;
}

export function getNetwork(code) {
  return SOCIAL_NETWORKS.find((n) => n.code === code) || null;
}

export function minPriceFor(networkCode, actionType, meaningfulComment = false) {
  if (meaningfulComment && actionType === "COMMENT") {
    return MEANINGFUL_COMMENT_MIN_PRICE;
  }
  const networkFloor = HIGH_MIN_PRICE_NETWORKS[networkCode] || 0;
  const actionFloor = MIN_PRICES[actionType] || 2;
  return Math.max(networkFloor, actionFloor, 2);
}
