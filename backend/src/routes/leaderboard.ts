import { Hono } from "hono";
import type { AppEnv } from "../types/index.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { db } from "../db/client.js";
import { leaderboardCache, users } from "../db/schema.js";
import { desc, inArray, eq, and } from "drizzle-orm";

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

  // Join with users table to:
  // 1. Exclude deleted/inactive users in real-time (not waiting for daily cache rebuild)
  // 2. Use the current role from users table so role changes reflect immediately
  const rows = await db
    .select({
      id:            leaderboardCache.id,
      userId:        leaderboardCache.userId,
      name:          leaderboardCache.name,
      role:          users.role,
      totalPosted:   leaderboardCache.totalPosted,
      totalUpvotes:  leaderboardCache.totalUpvotes,
      last24hPosted: leaderboardCache.last24hPosted,
      avgPerDay:     leaderboardCache.avgPerDay,
      upvoteRate:    leaderboardCache.upvoteRate,
      activeDays:    leaderboardCache.activeDays,
      firstPostedAt: leaderboardCache.firstPostedAt,
      updatedAt:     leaderboardCache.updatedAt,
    })
    .from(leaderboardCache)
    .innerJoin(users, eq(leaderboardCache.userId, users.id))
    .where(
      and(
        eq(users.isDeleted, false),
        eq(users.isActive, true),
        inArray(users.role, visibleRoles)
      )
    )
    .orderBy(desc(leaderboardCache.avgPerDay));

  return c.json(rows);
});
