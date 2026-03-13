import { Hono } from "hono";
import { db } from "../db/client.js";
import { users, monitorAssignments, holderAccounts, invitedUsers } from "../db/schema.js";
import { eq, sql, desc } from "drizzle-orm";
import { requireAuth, requireRole } from "../middleware/requireAuth.js";
import { hashPassword } from "../lib/auth.js";

export const adminRoutes = new Hono();

adminRoutes.use("*", requireAuth);
adminRoutes.use("*", requireRole("main"));

// GET /api/admin/monitors — users who have the "monitor" role
adminRoutes.get("/monitors", async (c) => {
  const monitors = await db.select().from(users).where(sql`'monitor' = ANY(${users.roles})`);
  return c.json(monitors.map((m) => ({ id: m.id, name: m.name, email: m.email, roles: m.roles, createdAt: m.createdAt })));
});

// POST /api/admin/monitors — create a monitor account, or add monitor role to existing user
adminRoutes.post("/monitors", async (c) => {
  const { email, password, name, phone } = await c.req.json();
  if (!email || !name) return c.json({ error: "email and name required" }, 400);

  // Check if user already exists
  const [existing] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (existing) {
    // Add monitor role to existing user
    const currentRoles = existing.roles && existing.roles.length > 0 ? existing.roles : [existing.role];
    if (currentRoles.includes("monitor")) {
      return c.json({ error: "This user already has the monitor role" }, 409);
    }
    const newRoles = [...currentRoles, "monitor"];
    const [updated] = await db.update(users).set({ roles: newRoles }).where(eq(users.id, existing.id)).returning();
    return c.json({ id: updated.id, email: updated.email, name: updated.name, roles: updated.roles, promoted: true });
  }

  // New user — password required
  if (!password) return c.json({ error: "password required for new accounts" }, 400);
  const passwordHash = await hashPassword(password);
  const [user] = await db.insert(users).values({ email, passwordHash, name, role: "monitor", roles: ["monitor"], phone }).returning();
  return c.json({ id: user.id, email: user.email, name: user.name, roles: user.roles });
});

// DELETE /api/admin/monitors/:id
adminRoutes.delete("/monitors/:id", async (c) => {
  const id = c.req.param("id");
  await db.delete(monitorAssignments).where(eq(monitorAssignments.monitorId, id));
  await db.delete(users).where(eq(users.id, id));
  return c.json({ ok: true });
});

// GET /api/admin/monitors/:id/assignments
adminRoutes.get("/monitors/:id/assignments", async (c) => {
  const monitorId = c.req.param("id");
  const rows = await db.select().from(monitorAssignments).where(eq(monitorAssignments.monitorId, monitorId));
  return c.json(rows);
});

// POST /api/admin/monitors/:id/assignments — assign a holder to a monitor
adminRoutes.post("/monitors/:id/assignments", async (c) => {
  const monitorId = c.req.param("id");
  const { holderId } = await c.req.json();
  const [row] = await db.insert(monitorAssignments).values({ monitorId, holderId }).returning();
  return c.json(row);
});

// DELETE /api/admin/monitors/:id/assignments/:holderId
adminRoutes.delete("/monitors/:id/assignments/:holderId", async (c) => {
  const monitorId = c.req.param("id");
  const holderId  = c.req.param("holderId");
  await db.delete(monitorAssignments)
    .where(eq(monitorAssignments.monitorId, monitorId));
  return c.json({ ok: true });
});

// PUT /api/admin/users/:id/roles — update roles for any user
adminRoutes.put("/users/:id/roles", async (c) => {
  const id = c.req.param("id");
  const { roles } = await c.req.json();
  if (!Array.isArray(roles) || roles.length === 0) return c.json({ error: "roles array required" }, 400);
  const validRoles = ["main", "monitor", "holder"];
  if (!roles.every((r: string) => validRoles.includes(r))) return c.json({ error: "Invalid role value" }, 400);
  const [user] = await db.update(users).set({ roles, role: roles[0] }).where(eq(users.id, id)).returning();
  if (!user) return c.json({ error: "User not found" }, 404);
  return c.json({ id: user.id, email: user.email, name: user.name, roles: user.roles });
});

// GET /api/admin/holders — users who have the "holder" role
adminRoutes.get("/holders", async (c) => {
  const holders = await db.select().from(users).where(sql`'holder' = ANY(${users.roles})`);
  return c.json(holders.map((h) => ({ id: h.id, name: h.name, email: h.email, roles: h.roles, createdAt: h.createdAt })));
});

// GET /api/admin/holders/:id/accounts
adminRoutes.get("/holders/:id/accounts", async (c) => {
  const holderId = c.req.param("id");
  const accounts = await db.select().from(holderAccounts).where(eq(holderAccounts.holderId, holderId));
  return c.json(accounts);
});

// POST /api/admin/holders/:id/accounts
adminRoutes.post("/holders/:id/accounts", async (c) => {
  const holderId = c.req.param("id");
  const { emailAddress, redditUsername, notes, subreddits } = await c.req.json();
  if (!emailAddress) return c.json({ error: "emailAddress required" }, 400);
  const [row] = await db.insert(holderAccounts).values({
    holderId,
    emailAddress,
    redditUsername: redditUsername || null,
    notes: notes || null,
    subreddits: subreddits ?? [],
  }).returning();
  return c.json(row);
});

// PUT /api/admin/holders/:id/accounts/:accountId
adminRoutes.put("/holders/:id/accounts/:accountId", async (c) => {
  const accountId = c.req.param("accountId");
  const { emailAddress, redditUsername, notes, subreddits } = await c.req.json();
  const [row] = await db.update(holderAccounts)
    .set({ emailAddress, redditUsername: redditUsername || null, notes: notes || null, subreddits: subreddits ?? [] })
    .where(eq(holderAccounts.id, accountId))
    .returning();
  if (!row) return c.json({ error: "Not found" }, 404);
  return c.json(row);
});

// DELETE /api/admin/holders/:id/accounts/:accountId
adminRoutes.delete("/holders/:id/accounts/:accountId", async (c) => {
  const accountId = c.req.param("accountId");
  await db.delete(holderAccounts).where(eq(holderAccounts.id, accountId));
  return c.json({ ok: true });
});

// ── Alerts ──────────────────────────────────────────────────────────────────

// GET /api/admin/alerts — new signups not yet acknowledged by admin
adminRoutes.get("/alerts", async (c) => {
  const unacked = await db.select().from(users)
    .where(eq(users.adminAcknowledged, false))
    .orderBy(users.createdAt);

  return c.json({
    newSignups: unacked.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      roles: u.roles,
      createdAt: u.createdAt,
    })),
    total: unacked.length,
  });
});

// POST /api/admin/alerts/ack/:userId — mark one signup as acknowledged
adminRoutes.post("/alerts/ack/:userId", async (c) => {
  const userId = c.req.param("userId");
  await db.update(users).set({ adminAcknowledged: true }).where(eq(users.id, userId));
  return c.json({ ok: true });
});

// POST /api/admin/alerts/ack-all — mark all unacknowledged as seen
adminRoutes.post("/alerts/ack-all", async (c) => {
  await db.update(users).set({ adminAcknowledged: true }).where(eq(users.adminAcknowledged, false));
  return c.json({ ok: true });
});

// ── Invites (RBAC) ───────────────────────────────────────────────────────────

// GET /api/admin/invites
adminRoutes.get("/invites", async (c) => {
  const rows = await db.select().from(invitedUsers).orderBy(desc(invitedUsers.invitedAt));
  return c.json(rows);
});

// POST /api/admin/invites
adminRoutes.post("/invites", async (c) => {
  const { email, role } = await c.req.json();
  if (!email || !role) return c.json({ error: "email and role required" }, 400);
  if (!["monitor", "holder"].includes(role)) return c.json({ error: "Invalid role" }, 400);

  const [row] = await db.insert(invitedUsers)
    .values({ email: email.toLowerCase().trim(), role })
    .onConflictDoUpdate({ target: invitedUsers.email, set: { role } })
    .returning();
  return c.json(row);
});

// DELETE /api/admin/invites/:id
adminRoutes.delete("/invites/:id", async (c) => {
  const id = c.req.param("id");
  await db.delete(invitedUsers).where(eq(invitedUsers.id, id));
  return c.json({ ok: true });
});
