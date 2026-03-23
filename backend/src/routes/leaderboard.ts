import { Hono } from "hono";
import type { AppEnv } from "../types/index.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { db } from "../db/client.js";
import { leaderboardCache } from "../db/schema.js";
import { desc } from "drizzle-orm";

export const leaderboardRoutes = new Hono<AppEnv>();

leaderboardRoutes.use("*", requireAuth);

// GET /api/leaderboard — returns cached leaderboard sorted by total upvotes desc
leaderboardRoutes.get("/", async (c) => {
  const rows = await db
    .select()
    .from(leaderboardCache)
    .orderBy(desc(leaderboardCache.totalUpvotes));
  return c.json(rows);
});
