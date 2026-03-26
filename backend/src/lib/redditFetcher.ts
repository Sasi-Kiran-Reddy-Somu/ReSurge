import type { RedditPost } from "../types/index.js";

const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

const CHUNK_SIZE = 20;

/**
 * Fetch latest posts from multiple subreddits, chunked into batches of CHUNK_SIZE.
 * Uses multi-subreddit URL: /r/sub1+sub2+sub3/new.json
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

  async function fetchChunk(chunk: string[]): Promise<RedditPost[]> {
    const joined = chunk.join("+");
    const url = `https://www.reddit.com/r/${joined}/new.json?limit=${limit}`;

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const res = await fetch(url, {
          headers: { "User-Agent": USER_AGENT, "Accept": "application/json" },
        });
        if (res.status === 429) throw new Error("Rate limited by Reddit");
        if (!res.ok) { console.warn(`[Fetcher] Chunk ${joined} HTTP ${res.status}`); return []; }

        const data = await res.json() as {
          data?: { children?: Array<{ data: RedditPost }> }
        };
        return (data?.data?.children ?? []).map((c) => c.data);
      } catch (err) {
        console.warn(`[Fetcher] Chunk ${joined} attempt ${attempt} failed:`, (err as Error).message);
        if (attempt < 3) await new Promise(r => setTimeout(r, 1000 * attempt));
      }
    }
    console.warn(`[Fetcher] Chunk ${joined} skipped after 3 attempts`);
    return [];
  }

  const chunkResults = await Promise.all(chunks.map(fetchChunk));
  return chunkResults.flat();
}

/**
 * Refresh engagement scores for a batch of post IDs.
 * All IDs across all subreddits are merged and batched into groups of 100.
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

  await Promise.all(chunks.map(async (chunk) => {
    const ids = chunk.map((id) => `t3_${id}`).join(",");
    const url = `https://www.reddit.com/api/info.json?id=${ids}`;

    try {
      const res = await fetch(url, {
        headers: { "User-Agent": USER_AGENT, "Accept": "application/json" },
      });
      if (!res.ok) {
        console.warn(`[Fetcher] api/info.json HTTP ${res.status}`);
        return;
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
  }));

  return result;
}
