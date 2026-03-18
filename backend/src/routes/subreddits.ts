import { Hono } from "hono";
import { db } from "../db/client.js";
import { subreddits, posts, holderAccounts, notifications } from "../db/schema.js";
import { eq, and, isNotNull, gte, sql, inArray } from "drizzle-orm";

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
        ? and(eq(subreddits.isActive, true), eq(subreddits.visibleToHolders, true), eq(subreddits.isPaused, false))
        : eq(subreddits.isActive, true)
    )
    .orderBy(subreddits.addedAt);

  return c.json(rows);
});

// GET /api/subreddits/bulk-stats — subscriberCount + avgNotifiedPerDay for all active subs
subredditRoutes.get("/bulk-stats", async (c) => {
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;

  const allSubs = await db.select({ name: subreddits.name, addedAt: subreddits.addedAt })
    .from(subreddits).where(eq(subreddits.isActive, true));

  if (allSubs.length === 0) return c.json([]);

  const subNames = allSubs.map(s => s.name);

  // Count holder accounts subscribed per subreddit (single query)
  const holderRows = await db.select({ subreddits: holderAccounts.subreddits }).from(holderAccounts);
  const holderCountMap = new Map<string, number>();
  for (const row of holderRows) {
    for (const sub of (row.subreddits ?? [])) {
      if (sub.startsWith("~")) continue;
      holderCountMap.set(sub, (holderCountMap.get(sub) ?? 0) + 1);
    }
  }

  // Count alerted posts per subreddit in last 30 days
  const alertCounts = await db
    .select({ subreddit: posts.subreddit, count: sql<number>`count(*)::int` })
    .from(posts)
    .where(and(inArray(posts.subreddit, subNames), isNotNull(posts.alertedAt), gte(posts.alertedAt, thirtyDaysAgo)))
    .groupBy(posts.subreddit);

  const alertMap = new Map(alertCounts.map(r => [r.subreddit, Number(r.count)]));

  const result = allSubs.map(s => {
    const daysSinceAdded = (Date.now() - new Date(s.addedAt).getTime()) / (24 * 60 * 60 * 1000);
    const windowDays = Math.max(1, Math.min(30, daysSinceAdded));
    const count = alertMap.get(s.name) ?? 0;
    return {
      name: s.name,
      subscriberCount: holderCountMap.get(s.name) ?? 0,
      avgNotifiedPerDay: Math.trunc((count / windowDays) * 10) / 10,
    };
  });

  return c.json(result);
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

// PATCH /api/subreddits/:name/pause
subredditRoutes.patch("/:name/pause", async (c) => {
  const name = c.req.param("name").toLowerCase();
  const body = await c.req.json<{ isPaused: boolean }>();

  const [updated] = await db
    .update(subreddits)
    .set({ isPaused: body.isPaused })
    .where(eq(subreddits.name, name))
    .returning();

  if (!updated) return c.json({ error: "Not found" }, 404);
  return c.json(updated);
});

// DELETE /api/subreddits/:id  (id = UUID)
// Also accepts name as fallback via ?name= query param
subredditRoutes.delete("/:id", async (c) => {
  const id = c.req.param("id");
  const nameParam = c.req.query("name");

  if (nameParam) {
    // Fallback: delete by name (for backwards compat)
    await db.update(subreddits).set({ isActive: false }).where(eq(subreddits.name, nameParam.toLowerCase()));
  } else {
    await db.update(subreddits).set({ isActive: false }).where(eq(subreddits.id, id));
  }

  return c.json({ ok: true });
});
