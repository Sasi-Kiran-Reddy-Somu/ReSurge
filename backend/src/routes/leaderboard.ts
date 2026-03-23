import { Hono } from "hono";
import type { AppEnv } from "../types/index.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { db } from "../db/client.js";
import { leaderboardCache } from "../db/schema.js";
import { desc, inArray, eq } from "drizzle-orm";

export const leaderboardRoutes = new Hono<AppEnv>();

leaderboardRoutes.use("*", requireAuth);

// GET /api/leaderboard
// - holder    → sees only other holders (not monitors)
// - monitor   → sees holders + monitors
// - main/admin → sees holders + monitors
leaderboardRoutes.get("/", async (c) => {
  const requesterRole = c.get("userRole") as string;

  const visibleRoles = requesterRole === "holder"
    ? ["holder"]
    : ["holder", "monitor"];

  const rows = await db
    .select()
    .from(leaderboardCache)
    .where(inArray(leaderboardCache.role, visibleRoles))
    .orderBy(desc(leaderboardCache.avgPerDay));

  return c.json(rows);
});
