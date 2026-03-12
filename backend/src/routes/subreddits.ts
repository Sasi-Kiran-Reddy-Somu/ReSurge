import { Hono } from "hono";
import { db } from "../db/client.js";
import { subreddits, posts, holderAccounts, notifications } from "../db/schema.js";
import { eq, and, isNotNull, gte, sql } from "drizzle-orm";

export const subredditRoutes = new Hono();

// GET /api/subreddits
// Pass ?visibleOnly=true to filter hidden subreddits (for holder portal)
subredditRoutes.get("/", async (c) => {
  const visibleOnly = c.req.query("visibleOnly") === "true";

  const rows = await db
    .select()
    .from(subreddits)
    .where(
      visibleOnly
        ? and(eq(subreddits.isActive, true), eq(subreddits.visibleToHolders, true))
        : eq(subreddits.isActive, true)
    )
    .orderBy(subreddits.addedAt);

  return c.json(rows);
});

// GET /api/subreddits/:name/stats
subredditRoutes.get("/:name/stats", async (c) => {
  const name = c.req.param("name").toLowerCase();
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;

  // Count holders (accounts) subscribed to this subreddit
  // holderAccounts.subreddits is a text[] column
  const [subRow] = await db
    .select()
    .from(subreddits)
    .where(eq(subreddits.name, name))
    .limit(1);

  if (!subRow) return c.json({ error: "Not found" }, 404);

  // Count accounts that include this subreddit
  const [{ count: subscriberCount }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(holderAccounts)
    .where(sql`${name} = ANY(${holderAccounts.subreddits})`);

  // Count posts that reached stack 4 in last 30 days
  const [{ count: alertedCount }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(posts)
    .where(
      and(
        eq(posts.subreddit, name),
        isNotNull(posts.alertedAt),
        gte(posts.alertedAt, thirtyDaysAgo)
      )
    );

  // Count posted comments (notifications with status=posted) in last 30 days
  const thirtyDaysAgoDate = new Date(thirtyDaysAgo);
  const [{ count: postedCount }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(notifications)
    .where(
      and(
        eq(notifications.subreddit, name),
        eq(notifications.status, "posted"),
        gte(notifications.sentAt, thirtyDaysAgoDate)
      )
    );

  // Total posts ever notified
  const [{ count: totalAlerted }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(posts)
    .where(
      and(
        eq(posts.subreddit, name),
        isNotNull(posts.alertedAt)
      )
    );

  // Use actual days tracked (capped at 30) so avg is correct for new subreddits
  const daysSinceAdded = (Date.now() - new Date(subRow.addedAt).getTime()) / (24 * 60 * 60 * 1000);
  const windowDays = Math.max(1, Math.min(30, daysSinceAdded));

  return c.json({
    subscriberCount: Number(subscriberCount),
    avgNotifiedPerDay: Math.trunc((Number(alertedCount) / windowDays) * 10) / 10,
    avgPostedPerDay: Math.trunc((Number(postedCount) / windowDays) * 10) / 10,
    totalAlerted: Number(totalAlerted),
    visibleToHolders: subRow.visibleToHolders,
  });
});

// POST /api/subreddits  { name: "entrepreneur" }
subredditRoutes.post("/", async (c) => {
  const body = await c.req.json<{ name: string }>();
  const name = body.name?.replace(/^r\//, "").trim().toLowerCase();

  if (!name) {
    return c.json({ error: "name is required" }, 400);
  }

  // Check for duplicate
  const existing = await db
    .select()
    .from(subreddits)
    .where(eq(subreddits.name, name))
    .limit(1);

  if (existing.length > 0 && existing[0].isActive) {
    return c.json({ error: "Subreddit already tracked" }, 409);
  }

  // Re-activate if was previously removed
  if (existing.length > 0 && !existing[0].isActive) {
    const [updated] = await db
      .update(subreddits)
      .set({ isActive: true })
      .where(eq(subreddits.name, name))
      .returning();

    return c.json(updated, 200);
  }

  // Insert new
  const [inserted] = await db
    .insert(subreddits)
    .values({ name })
    .returning();

  return c.json(inserted, 201);
});

// PATCH /api/subreddits/:name/visibility
subredditRoutes.patch("/:name/visibility", async (c) => {
  const name = c.req.param("name").toLowerCase();
  const body = await c.req.json<{ visibleToHolders: boolean }>();

  const [updated] = await db
    .update(subreddits)
    .set({ visibleToHolders: body.visibleToHolders })
    .where(eq(subreddits.name, name))
    .returning();

  if (!updated) return c.json({ error: "Not found" }, 404);
  return c.json(updated);
});

// DELETE /api/subreddits/:name
subredditRoutes.delete("/:name", async (c) => {
  const name = c.req.param("name").toLowerCase();

  await db
    .update(subreddits)
    .set({ isActive: false })
    .where(eq(subreddits.name, name));

  return c.json({ ok: true });
});
