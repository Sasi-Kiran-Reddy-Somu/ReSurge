import type { RedditPost } from "../types/index.js";

const USER_AGENT = "ReSurge/1.0 (internal tool)";

function parseRedditRSS(xml: string, subreddit: string): RedditPost[] {
  const posts: RedditPost[] = [];
  const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
  let match: RegExpExecArray | null;

  while ((match = entryRegex.exec(xml)) !== null) {
    const entry = match[1];

    // Extract link href (alternate)
    const linkMatch = entry.match(/<link[^>]+rel="alternate"[^>]+href="([^"]+)"/);
    if (!linkMatch) continue;
    const href = linkMatch[1];

    // Extract Reddit post ID from URL: /comments/ABC123/
    const idMatch = href.match(/\/comments\/([a-z0-9]+)\//i);
    if (!idMatch) continue;
    const id = idMatch[1];

    // Build permalink (path only)
    const permalink = href.replace("https://www.reddit.com", "");

    // Title (may be CDATA wrapped)
    const titleMatch = entry.match(/<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/);
    const title = titleMatch ? titleMatch[1].trim() : "";

    // Author
    const authorMatch = entry.match(/<author>\s*<name>([^<]*)<\/name>/);
    const author = authorMatch ? authorMatch[1].trim() : "";

    // Published timestamp
    const publishedMatch = entry.match(/<published>([^<]+)<\/published>/);
    const created_utc = publishedMatch ? Math.floor(Date.parse(publishedMatch[1]) / 1000) : 0;

    posts.push({
      id,
      title,
      permalink,
      score: 0,
      num_comments: 0,
      created_utc,
      author,
      selftext: "",
      subreddit,
    });
  }

  return posts;
}

/**
 * Fetch latest posts from subreddits via RSS (one request per subreddit).
 * RSS is significantly less blocked than .json endpoints from datacenter IPs.
 */
export async function fetchNewPostsRSS(subreddits: string[]): Promise<RedditPost[]> {
  if (subreddits.length === 0) return [];

  const results: RedditPost[] = [];

  for (const sub of subreddits) {
    const url = `https://www.reddit.com/r/${sub}/new.rss?limit=25`;
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": USER_AGENT, "Accept": "application/rss+xml, application/xml" },
      });
      if (!res.ok) {
        console.warn(`[RSS] r/${sub} HTTP ${res.status}`);
        continue;
      }
      const xml = await res.text();
      const posts = parseRedditRSS(xml, sub);
      console.log(`[RSS] Fetched ${posts.length} posts from r/${sub}`);
      results.push(...posts);
    } catch (err) {
      console.warn(`[RSS] r/${sub} failed:`, (err as Error).message);
    }
  }

  return results;
}

/**
 * Refresh engagement scores for a batch of post IDs across any subreddits.
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
