import type { RedditPost } from "../types/index.js";
import { ProxyAgent, setGlobalDispatcher } from "undici";

const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

// Configure IPRoyal residential proxy if env var is set
const PROXY_URL = process.env.IPROYAL_PROXY_URL ?? null;
if (PROXY_URL) {
  setGlobalDispatcher(new ProxyAgent(PROXY_URL));
  console.log("[Proxy] IPRoyal residential proxy active");
}

function parseRedditRSS(xml: string, subreddit: string): RedditPost[] {
  const posts: RedditPost[] = [];
  const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
  let match: RegExpExecArray | null;

  while ((match = entryRegex.exec(xml)) !== null) {
    const entry = match[1];

    const linkMatch = entry.match(/<link[^>]+rel="alternate"[^>]+href="([^"]+)"/);
    if (!linkMatch) continue;
    const href = linkMatch[1];

    const idMatch = href.match(/\/comments\/([a-z0-9]+)\//i);
    if (!idMatch) continue;
    const id = idMatch[1];

    const permalink = href.replace("https://www.reddit.com", "");

    const titleMatch = entry.match(/<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/);
    const title = titleMatch ? titleMatch[1].trim() : "";

    const authorMatch = entry.match(/<author>\s*<name>([^<]*)<\/name>/);
    const author = authorMatch ? authorMatch[1].trim() : "";

    const publishedMatch = entry.match(/<published>([^<]+)<\/published>/);
    const created_utc = publishedMatch ? Math.floor(Date.parse(publishedMatch[1]) / 1000) : 0;

    posts.push({ id, title, permalink, score: 0, num_comments: 0, created_utc, author, selftext: "", subreddit });
  }

  return posts;
}

/**
 * Fetch latest posts from subreddits via RSS, routed through IPRoyal proxy if configured.
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
 * Refresh engagement scores for a batch of post IDs, routed through IPRoyal proxy if configured.
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
