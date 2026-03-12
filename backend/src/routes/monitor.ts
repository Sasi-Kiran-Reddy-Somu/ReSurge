import { Hono } from "hono";
import { db } from "../db/client.js";
import { users, monitorAssignments, userSubreddits, notifications, holderAccounts } from "../db/schema.js";
import { eq, desc, inArray, sql } from "drizzle-orm";
import { requireAuth, requireRole } from "../middleware/requireAuth.js";

export const monitorRoutes = new Hono();

monitorRoutes.use("*", requireAuth);
monitorRoutes.use("*", requireRole("monitor", "main"));

// GET /api/monitor/holders — all holders assigned to this monitor (or all if main role)
monitorRoutes.get("/holders", async (c) => {
  const monitorId = c.get("userId") as string;
  const role      = c.get("userRole") as string;

  let holderIds: string[];
  if (role === "main") {
    // Use roles array check so multi-role users (holder + monitor) are included
    const all = await db.select().from(users).where(sql`'holder' = ANY(${users.roles})`);
    holderIds = all.map((u) => u.id);
  } else {
    const assignments = await db.select().from(monitorAssignments).where(eq(monitorAssignments.monitorId, monitorId));
    holderIds = assignments.map((a) => a.holderId);
  }

  if (holderIds.length === 0) return c.json([]);

  // Batch-fetch all assignments for these holders to resolve monitor names efficiently
  const allAssignments = await db.select().from(monitorAssignments)
    .where(inArray(monitorAssignments.holderId, holderIds));

  const monitorIds = [...new Set(allAssignments.map((a) => a.monitorId))];
  const monitorUsers = monitorIds.length > 0
    ? await db.select({ id: users.id, name: users.name }).from(users).where(inArray(users.id, monitorIds))
    : [];
  const monitorNameMap = new Map(monitorUsers.map((m) => [m.id, m.name]));

  const holders = await Promise.all(holderIds.map(async (id) => {
    const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
    if (!user) return null;
    const subs     = await db.select().from(userSubreddits).where(eq(userSubreddits.userId, id));
    const accounts = await db.select().from(holderAccounts).where(eq(holderAccounts.holderId, id));
    const notifs   = await db.select().from(notifications).where(eq(notifications.userId, id));
    const converted = notifs.filter((n) => n.status === "posted").length;

    const assignment = allAssignments.find((a) => a.holderId === id);
    const monitorName = assignment ? (monitorNameMap.get(assignment.monitorId) ?? null) : null;

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      subreddits: subs.map((s) => s.subreddit),
      accounts,
      totalNotifications: notifs.length,
      converted,
      monitorName,
    };
  }));

  return c.json(holders.filter(Boolean));
});

// GET /api/monitor/holders/:id — holder detail
monitorRoutes.get("/holders/:id", async (c) => {
  const holderId = c.req.param("id");
  const [user] = await db.select().from(users).where(eq(users.id, holderId)).limit(1);
  if (!user) return c.json({ error: "Not found" }, 404);
  const userRoles = (user.roles && user.roles.length > 0) ? user.roles : [user.role];
  if (!userRoles.includes("holder")) return c.json({ error: "Not found" }, 404);

  const subs     = await db.select().from(userSubreddits).where(eq(userSubreddits.userId, holderId));
  const accounts = await db.select().from(holderAccounts).where(eq(holderAccounts.holderId, holderId));
  const notifs   = await db.select().from(notifications).where(eq(notifications.userId, holderId)).orderBy(desc(notifications.sentAt));

  return c.json({
    id: user.id, name: user.name, email: user.email, phone: user.phone,
    subreddits: subs.map((s) => s.subreddit),
    accounts,
    notifications: notifs,
  });
});
