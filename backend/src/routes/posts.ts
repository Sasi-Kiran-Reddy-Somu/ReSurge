import { Hono } from "hono";
import { db } from "../db/client.js";
import { posts, generatedComments } from "../db/schema.js";
import { eq, and, desc, isNotNull } from "drizzle-orm";
import { generateComment } from "../lib/commentGenerator.js";

export const postRoutes = new Hono();

// GET /api/posts/:subreddit/stack/:stack
// Returns all active (non-discarded) posts in a given stack for a subreddit
postRoutes.get("/:subreddit/stack/:stack", async (c) => {
  const subreddit = c.req.param("subreddit").toLowerCase();
  const stack = parseInt(c.req.param("stack"));

  if (isNaN(stack) || stack < 1 || stack > 3) {
    return c.json({ error: "Stack must be 1–3" }, 400);
  }

  const rows = await db
    .select()
    .from(posts)
    .where(
      and(
        eq(posts.subreddit, subreddit),
        eq(posts.stack, stack),
        eq(posts.discarded, false)
      )
    )
    .orderBy(desc(posts.stackEnteredAt));

  return c.json(rows);
});

// GET /api/posts/stack3/all
// Returns ALL Stack 3 (alert) posts across all subreddits, newest first
postRoutes.get("/stack3/all", async (c) => {
  const subreddit = c.req.query("subreddit");

  const conditions = [eq(posts.stack, 3), eq(posts.discarded, false)];
  if (subreddit) {
    conditions.push(eq(posts.subreddit, subreddit.toLowerCase()));
  }

  const rows = await db
    .select()
    .from(posts)
    .where(and(...conditions))
    .orderBy(desc(posts.alertedAt));

  return c.json(rows);
});

// DELETE /api/posts/:id/dismiss
// Dismiss (soft-delete from feed) a Stack 3 alert post
postRoutes.delete("/:id/dismiss", async (c) => {
  const id = c.req.param("id");

  await db
    .update(posts)
    .set({ discarded: true, updatedAt: new Date() })
    .where(eq(posts.id, id));

  return c.json({ ok: true });
});

// POST /api/posts/:id/generate-comment
// Generate a human-sounding comment via OpenAI for a Stack 3 alert post
postRoutes.post("/:id/generate-comment", async (c) => {
  const id = c.req.param("id");

  const [post] = await db.select().from(posts).where(eq(posts.id, id)).limit(1);
  if (!post) return c.json({ error: "Post not found" }, 404);

  const body = await c.req.json().catch(() => ({}));
  const tone: string | undefined = body.tone || undefined;
  const customPrompt: string | undefined = body.customPrompt || undefined;

  try {
    const comment = await generateComment(post, tone, customPrompt);

    await db.insert(generatedComments).values({
      postId:      post.id,
      provider:    "openai",
      suggestions: JSON.stringify([comment]),
    });

    return c.json({ comment });
  } catch (err: any) {
    return c.json({ error: err.message ?? "Failed to generate comment" }, 500);
  }
});

// GET /api/posts/history/all
// Returns all posts that reached Stack 3 (alertedAt is set) across ALL subreddits, newest first
postRoutes.get("/history/all", async (c) => {
  const rows = await db
    .select()
    .from(posts)
    .where(isNotNull(posts.alertedAt))
    .orderBy(desc(posts.alertedAt));

  return c.json(rows);
});

// GET /api/posts/:subreddit/history
// Returns all posts that reached Stack 3 (alertedAt is set), newest first
postRoutes.get("/:subreddit/history", async (c) => {
  const subreddit = c.req.param("subreddit").toLowerCase();

  const rows = await db
    .select()
    .from(posts)
    .where(
      and(
        eq(posts.subreddit, subreddit),
        isNotNull(posts.alertedAt)
      )
    )
    .orderBy(desc(posts.alertedAt));

  return c.json(rows);
});

// GET /api/posts/:subreddit/counts
// Returns stack counts for a subreddit
postRoutes.get("/:subreddit/counts", async (c) => {
  const subreddit = c.req.param("subreddit").toLowerCase();

  const allPosts = await db
    .select({ stack: posts.stack })
    .from(posts)
    .where(
      and(
        eq(posts.subreddit, subreddit),
        eq(posts.discarded, false)
      )
    );

  const counts = { s1: 0, s2: 0, s3: 0 };
  for (const p of allPosts) {
    const key = `s${p.stack}` as keyof typeof counts;
    if (key in counts) counts[key]++;
  }

  return c.json(counts);
});
