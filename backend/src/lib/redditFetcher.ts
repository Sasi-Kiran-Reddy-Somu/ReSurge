import type { RedditPost } from "../types/index.js";
import { ProxyAgent, setGlobalDispatcher } from "undici";

const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

// Configure IPRoyal residential proxy if env var is set
const PROXY_URL = process.env.IPROYAL_PROXY_URL ?? null;
if (PROXY_URL) {
  setGlobalDispatcher(new ProxyAgent(PROXY_URL));
  console.log("[Proxy] IPRoyal residential proxy active");
}

const CHUNK_SIZE = 5;

/**
 * Fetch latest posts from multiple subreddits, chunked into batches of CHUNK_SIZE.
 * All requests are routed through IPRoyal proxy if IPROYAL_PROXY_URL is set.
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
    const url = `https://www.reddit.com/r/${joined}/new.json?limit=${limit}`;

    try {
      const res = await fetch(url, {
        headers: { "User-Agent": USER_AGENT, "Accept": "application/json" },
      });
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
 * Refresh engagement scores for a batch of post IDs.
 * All requests are routed through IPRoyal proxy if IPROYAL_PROXY_URL is set.
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
    const url = `https://www.reddit.com/api/info.json?id=${ids}`;

    try {
      const res = await fetch(url, {
        headers: { "User-Agent": USER_AGENT, "Accept": "application/json" },
      });
      if (!res.ok) {
        console.warn(`[Fetcher] api/info.json HTTP ${res.status}`);
        continue;
      }

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
