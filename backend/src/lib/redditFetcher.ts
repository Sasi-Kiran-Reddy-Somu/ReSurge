import type { RedditPost } from "../types/index.js";

const USER_AGENT = "ReSurge/1.0 (internal tool)";

// Max subreddits per multi-sub request. Each call gets limit=100 posts shared
// across CHUNK_SIZE subs (~20 each). Tune higher to reduce calls, lower for more coverage.
const CHUNK_SIZE = 5;

/**
 * Fetch latest posts from multiple subreddits, chunked into batches of CHUNK_SIZE.
 * Each batch uses Reddit's multi-subreddit syntax: r/sub1+sub2+.../new.json?limit=100
 * so each batch gets ~20 posts per subreddit. Results from all batches are merged.
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
    const url = `https://www.reddit.com/r/${chunk.join("+")}/new.json?limit=${limit}`;
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": USER_AGENT, "Accept": "application/json" },
      });
      if (res.status === 429) throw new Error("Rate limited by Reddit");
      if (!res.ok) { console.warn(`[Fetcher] Chunk ${chunk.join("+")} HTTP ${res.status}`); continue; }

      const data = await res.json() as {
        data?: { children?: Array<{ data: RedditPost }> }
      };
      results.push(...(data?.data?.children ?? []).map((c) => c.data));
    } catch (err) {
      // Log but don't abort — other chunks can still succeed
      console.warn(`[Fetcher] Chunk ${chunk.join("+")} failed:`, (err as Error).message);
    }
  }

  return results;
}

/**
 * Refresh engagement scores for a batch of post IDs across any subreddits.
 * Uses the global api/info.json endpoint — up to 100 IDs per call.
 */
export async function refreshPostEngagement(
  redditIds: string[]
): Promise<Map<string, { upvotes: number; comments: number; engagement: number }>> {
  const result = new Map<string, { upvotes: number; comments: number; engagement: number }>();
  if (redditIds.length === 0) return result;

  // Chunk into 100s
  const chunks: string[][] = [];
  for (let i = 0; i < redditIds.length; i += 100) {
    chunks.push(redditIds.slice(i, i + 100));
  }

  for (const chunk of chunks) {
    const ids = chunk.map((id) => `t3_${id}`).join(",");
    const url = `https://www.reddit.com/api/info.json?id=${ids}`;

    try {
      const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
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
