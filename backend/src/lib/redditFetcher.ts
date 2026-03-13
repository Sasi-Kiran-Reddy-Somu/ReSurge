import type { RedditPost } from "../types/index.js";

const USER_AGENT = "ReSurge/1.0 (internal tool)";

// Max subreddits per multi-sub request.
const CHUNK_SIZE = 5;

// Cloudflare Worker proxy (set REDDIT_PROXY_URL in Railway env vars)
const PROXY_URL    = process.env.REDDIT_PROXY_URL?.replace(/\/$/, "") ?? null;
const PROXY_SECRET = process.env.REDDIT_PROXY_SECRET ?? null;

function proxyHeaders(): Record<string, string> {
  const h: Record<string, string> = { "User-Agent": USER_AGENT, "Accept": "application/json" };
  if (PROXY_SECRET) h["X-Worker-Secret"] = PROXY_SECRET;
  return h;
}

/**
 * Fetch latest posts from multiple subreddits, chunked into batches of CHUNK_SIZE.
 * Uses Cloudflare Worker proxy if REDDIT_PROXY_URL is set, otherwise hits Reddit directly.
 */
export async function fetchNewPostsMulti(
  subreddits: string[],
  limit = 100
): Promise<RedditPost[]> {
  if (subreddits.length === 0) return [];

  const chunks: string[][] = [];
  for (let i = 0; i < subreddits.length; i += CHUNK_SIZE) {
    chunks.push(subreddits.slice(i, i + CHUNK_SIZE));
  }

  const results: RedditPost[] = [];

  for (const chunk of chunks) {
    const joined = chunk.join("+");
    const url = PROXY_URL
      ? `${PROXY_URL}/new?subs=${encodeURIComponent(joined)}&limit=${limit}`
      : `https://www.reddit.com/r/${joined}/new.json?limit=${limit}`;

    try {
      const res = await fetch(url, { headers: proxyHeaders() });
      if (res.status === 429) throw new Error("Rate limited by Reddit");
      if (!res.ok) { console.warn(`[Fetcher] Chunk ${joined} HTTP ${res.status}`); continue; }

      const data = await res.json() as {
        data?: { children?: Array<{ data: RedditPost }> }
      };
      results.push(...(data?.data?.children ?? []).map((c) => c.data));
    } catch (err) {
      console.warn(`[Fetcher] Chunk ${joined} failed:`, (err as Error).message);
    }
  }

  return results;
}

/**
 * Refresh engagement scores for a batch of post IDs across any subreddits.
 * Uses Cloudflare Worker proxy if REDDIT_PROXY_URL is set.
 */
export async function refreshPostEngagement(
  redditIds: string[]
): Promise<Map<string, { upvotes: number; comments: number; engagement: number }>> {
  const result = new Map<string, { upvotes: number; comments: number; engagement: number }>();
  if (redditIds.length === 0) return result;

  const chunks: string[][] = [];
  for (let i = 0; i < redditIds.length; i += 100) {
    chunks.push(redditIds.slice(i, i + 100));
  }

  for (const chunk of chunks) {
    const ids = chunk.map((id) => `t3_${id}`).join(",");
    const url = PROXY_URL
      ? `${PROXY_URL}/info?ids=${encodeURIComponent(ids)}`
      : `https://www.reddit.com/api/info.json?id=${ids}`;

    try {
      const res = await fetch(url, { headers: proxyHeaders() });
      if (!res.ok) continue;

      const data = await res.json() as {
        data?: { children?: Array<{ data: RedditPost & { score: number } }> }
      };

      for (const child of data?.data?.children ?? []) {
        const p = child.data;
        result.set(p.id, {
          upvotes:    p.score,
          comments:   p.num_comments,
          engagement: p.score + p.num_comments,
        });
      }
    } catch {
      // Silently continue on partial failures
    }
  }

  return result;
}
