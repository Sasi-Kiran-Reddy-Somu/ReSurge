import { Hono } from "hono";
import { db } from "../db/client.js";
import { users, userSubreddits, notifications, holderAccounts, subreddits } from "../db/schema.js";
import { eq, and, desc, not, inArray } from "drizzle-orm";
import { requireAuth } from "../middleware/requireAuth.js";
import type { AppEnv } from "../types/index.js";

async function getPausedSubredditNames(): Promise<Set<string>> {
  const rows = await db.select({ name: subreddits.name }).from(subreddits)
    .where(and(eq(subreddits.isActive, true), eq(subreddits.isPaused, true)));
  return new Set(rows.map(r => r.name));
}

export const holderRoutes = new Hono<AppEnv>();

holderRoutes.use("*", requireAuth);

// GET /api/holder/me
holderRoutes.get("/me", async (c) => {
  const userId = c.get("userId") as string;
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) return c.json({ error: "Not found" }, 404);
  return c.json({ id: user.id, email: user.email, name: user.name, phone: user.phone });
});

// GET /api/holder/subreddits — visible tracked subreddits + which ones user joined
holderRoutes.get("/subreddits", async (c) => {
  const userId = c.get("userId") as string;
  const all    = await db.select().from(subreddits).where(and(eq(subreddits.isActive, true), eq(subreddits.visibleToHolders, true)));
  const joined = await db.select().from(userSubreddits).where(eq(userSubreddits.userId, userId));
  const joinedSet = new Set(joined.map((j) => j.subreddit));
  return c.json(all.map((s) => ({ name: s.name, joined: joinedSet.has(s.name) })));
});

// PUT /api/holder/subreddits — update subscriptions
holderRoutes.put("/subreddits", async (c) => {
  const userId = c.get("userId") as string;
  const { subreddits: selected }: { subreddits: string[] } = await c.req.json();

  // Remove all existing, re-insert selected
  await db.delete(userSubreddits).where(eq(userSubreddits.userId, userId));
  if (selected.length > 0) {
    await db.insert(userSubreddits).values(selected.map((s) => ({ userId, subreddit: s })));
  }
  return c.json({ ok: true });
});

// GET /api/holder/notifications
holderRoutes.get("/notifications", async (c) => {
  const userId = c.get("userId") as string;
  const paused = await getPausedSubredditNames();
  const where  = paused.size > 0
    ? and(eq(notifications.userId, userId), not(inArray(notifications.subreddit, [...paused])))
    : eq(notifications.userId, userId);
  const rows = await db
    .select()
    .from(notifications)
    .where(where)
    .orderBy(desc(notifications.sentAt));
  return c.json(rows);
});

// GET /api/holder/notifications/:id
holderRoutes.get("/notifications/:id", async (c) => {
  const userId = c.get("userId") as string;
  const id     = c.req.param("id");
  const [row]  = await db
    .select()
    .from(notifications)
    .where(and(eq(notifications.id, id), eq(notifications.userId, userId)))
    .limit(1);
  if (!row) return c.json({ error: "Not found" }, 404);

  // Mark as opened
  if (row.status === "sent") {
    await db.update(notifications).set({ status: "opened", openedAt: new Date() }).where(eq(notifications.id, id));
  }
  return c.json(row);
});

// PUT /api/holder/notifications/:id/posted
holderRoutes.put("/notifications/:id/posted", async (c) => {
  const userId = c.get("userId") as string;
  const id     = c.req.param("id");
  const { postedLink } = await c.req.json();

  await db
    .update(notifications)
    .set({ status: "posted", postedLink, postedAt: new Date() })
    .where(and(eq(notifications.id, id), eq(notifications.userId, userId)));
  return c.json({ ok: true });
});

// PUT /api/holder/notifications/:id/done
holderRoutes.put("/notifications/:id/done", async (c) => {
  const userId = c.get("userId") as string;
  const id     = c.req.param("id");
  await db
    .update(notifications)
    .set({ status: "done" })
    .where(and(eq(notifications.id, id), eq(notifications.userId, userId)));
  return c.json({ ok: true });
});

// GET /api/holder/accounts
holderRoutes.get("/accounts", async (c) => {
  const userId = c.get("userId") as string;
  const rows   = await db.select().from(holderAccounts).where(eq(holderAccounts.holderId, userId));
  const globalPaused = await getPausedSubredditNames();
  // Parse ~prefix for per-account holds; strip globally paused subreddits
  const filtered = rows.map(acc => {
    const raw = acc.subreddits ?? [];
    return {
      ...acc,
      subreddits:       raw.filter(s => !s.startsWith("~") && !globalPaused.has(s)),
      pausedSubreddits: raw.filter(s => s.startsWith("~")).map(s => s.slice(1)),
    };
  });
  return c.json(filtered);
});

// POST /api/holder/accounts
holderRoutes.post("/accounts", async (c) => {
  const userId = c.get("userId") as string;
  const { emailAddress, redditUsername, notes, subreddits } = await c.req.json();
  if (!emailAddress) return c.json({ error: "emailAddress required" }, 400);
  const [row] = await db.insert(holderAccounts).values({ holderId: userId, emailAddress, redditUsername, notes, subreddits: subreddits ?? [] }).returning();
  return c.json(row);
});

// PUT /api/holder/accounts/:id — update subreddits for an account
holderRoutes.put("/accounts/:id", async (c) => {
  const userId    = c.get("userId") as string;
  const accountId = c.req.param("id");
  const { subreddits: active, pausedSubreddits: paused } = await c.req.json();
  const [row] = await db.select().from(holderAccounts)
    .where(and(eq(holderAccounts.id, accountId), eq(holderAccounts.holderId, userId))).limit(1);
  if (!row) return c.json({ error: "Not found" }, 404);
  // Store paused subreddits with ~ prefix in the same column
  const combined = [...(active ?? []), ...(paused ?? []).map((s: string) => `~${s}`)];
  const [updated] = await db.update(holderAccounts)
    .set({ subreddits: combined })
    .where(eq(holderAccounts.id, accountId))
    .returning();
  return c.json(updated);
});

// DELETE /api/holder/accounts/:id
holderRoutes.delete("/accounts/:id", async (c) => {
  const userId    = c.get("userId") as string;
  const accountId = c.req.param("id");
  // Only allow deleting own accounts
  const [row] = await db.select().from(holderAccounts).where(and(eq(holderAccounts.id, accountId), eq(holderAccounts.holderId, userId))).limit(1);
  if (!row) return c.json({ error: "Not found" }, 404);
  await db.delete(holderAccounts).where(eq(holderAccounts.id, accountId));
  return c.json({ ok: true });
});
