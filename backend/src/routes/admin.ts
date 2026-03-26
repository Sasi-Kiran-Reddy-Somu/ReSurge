import { Hono } from "hono";
import { db } from "../db/client.js";
import { users, monitorAssignments, holderAccounts, invitedUsers } from "../db/schema.js";
import { eq, sql, desc } from "drizzle-orm";
import { requireAuth, requireRole } from "../middleware/requireAuth.js";
import { hashPassword } from "../lib/auth.js";
import { sendInviteEmail, sendStack3Notification } from "../lib/emailer.js";
import { signToken } from "../lib/auth.js";
import { getWorkerStatus } from "../lib/workerStatus.js";

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

// POST /api/admin/backfill-monitors — one-time: give all monitors holder role + self-assignment
adminRoutes.post("/backfill-monitors", async (c) => {
  const monitors = await db.select().from(users).where(sql`'monitor' = ANY(${users.roles})`);
  const results = [];
  for (const m of monitors) {
    const currentRoles = m.roles?.length ? m.roles : [m.role];
    if (!currentRoles.includes("holder")) {
      const merged = [...new Set([...currentRoles, "holder"])];
      await db.update(users).set({ roles: merged }).where(eq(users.id, m.id));
    }
    const existing = await db.select().from(monitorAssignments)
      .where(eq(monitorAssignments.monitorId, m.id));
    const selfAssigned = existing.some((a) => a.holderId === m.id);
    if (!selfAssigned) {
      await db.insert(monitorAssignments).values({ monitorId: m.id, holderId: m.id });
    }
    results.push({ id: m.id, email: m.email, selfAssigned: !selfAssigned });
  }
  return c.json({ patched: results.length, results });
});

// GET /api/admin/holders — users who have "holder" OR "monitor" role (monitors are also holders)
adminRoutes.get("/holders", async (c) => {
  const holders = await db.select().from(users).where(sql`'holder' = ANY(${users.roles}) OR 'monitor' = ANY(${users.roles})`);
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

// ── All users ────────────────────────────────────────────────────────────────

// GET /api/admin/users — all users (existing, for backward compat)
adminRoutes.get("/users", async (c) => {
  const all = await db.select().from(users).orderBy(desc(users.createdAt));
  return c.json(all.map(u => ({ id: u.id, name: u.name, email: u.email, role: u.role, roles: u.roles, createdAt: u.createdAt, isActive: u.isActive, isDeleted: u.isDeleted })));
});

// GET /api/admin/all-users — unified list: pending invites + signed-up users
adminRoutes.get("/all-users", async (c) => {
  const [allUsers, allInvites] = await Promise.all([
    db.select().from(users).orderBy(desc(users.createdAt)),
    db.select().from(invitedUsers).orderBy(desc(invitedUsers.invitedAt)),
  ]);
  const userRows = allUsers.map(u => ({
    type: "user" as const,
    id: u.id, name: u.name, email: u.email,
    role: u.role, roles: u.roles,
    isActive: u.isActive, isDeleted: u.isDeleted,
    status: u.isDeleted ? "deleted" : u.isActive ? "active" : "inactive",
    date: u.createdAt,
  }));
  const signedUpEmails = new Set(allUsers.map(u => u.email));
  const inviteRows = allInvites
    .filter(inv => !signedUpEmails.has(inv.email)) // skip stale invites for already-registered users
    .map(inv => ({
      type: "invite" as const,
      id: inv.id, name: null, email: inv.email,
      role: inv.role, roles: [inv.role],
      isActive: null, isDeleted: null,
      status: "invited" as const,
      date: inv.invitedAt,
    }));
  return c.json([...inviteRows, ...userRows]);
});

// PATCH /api/admin/users/:id — update role or status
adminRoutes.patch("/users/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();
  const validRoles = ["main", "monitor", "holder"];

  // Status change
  if (body.action === "deactivate") {
    const [user] = await db.update(users).set({ isActive: false }).where(eq(users.id, id)).returning();
    if (!user) return c.json({ error: "User not found" }, 404);
    return c.json({ ok: true, status: "inactive" });
  }
  if (body.action === "activate") {
    const [user] = await db.update(users).set({ isActive: true, isDeleted: false }).where(eq(users.id, id)).returning();
    if (!user) return c.json({ error: "User not found" }, 404);
    return c.json({ ok: true, status: "active" });
  }

  // Role change
  const { role } = body;
  if (!role || !validRoles.includes(role)) return c.json({ error: "Invalid role" }, 400);
  const [user] = await db.update(users).set({ role, roles: [role] }).where(eq(users.id, id)).returning();
  if (!user) return c.json({ error: "User not found" }, 404);
  return c.json({ id: user.id, email: user.email, name: user.name, role: user.role, roles: user.roles });
});

// DELETE /api/admin/users/:id — soft-delete (preserves data, blocks access)
adminRoutes.delete("/users/:id", async (c) => {
  const id = c.req.param("id");
  await db.update(users).set({ isActive: false, isDeleted: true }).where(eq(users.id, id));
  return c.json({ ok: true });
});

// POST /api/admin/users/:id/resend-invite — resend invite email to existing active user
adminRoutes.post("/users/:id/resend-invite", async (c) => {
  const id = c.req.param("id");
  const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  if (!user) return c.json({ error: "User not found" }, 404);
  sendInviteEmail({ toEmail: user.email, role: user.role }).catch(err => {
    console.error("[resend invite email]", err.message);
  });
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
  if (!["monitor", "holder", "main"].includes(role)) return c.json({ error: "Invalid role" }, 400);

  const normalizedEmail = email.toLowerCase().trim();

  // Check if user already exists
  const [existingUser] = await db.select().from(users).where(eq(users.email, normalizedEmail)).limit(1);
  if (existingUser) {
    const existingRole = existingUser.role ?? (existingUser.roles?.[0]);
    if (existingRole === role) {
      return c.json({ error: `User already exists as ${role}`, code: "USER_EXISTS_SAME_ROLE" }, 409);
    } else {
      return c.json({ error: `User already exists as ${existingRole}`, code: "USER_EXISTS_DIFF_ROLE", existingRole }, 409);
    }
  }

  // Check if invite already pending
  const [existingInvite] = await db.select().from(invitedUsers).where(eq(invitedUsers.email, normalizedEmail)).limit(1);
  if (existingInvite) {
    return c.json({ error: `Invite already sent to this email as ${existingInvite.role}`, code: "INVITE_EXISTS", existingRole: existingInvite.role }, 409);
  }

  const [row] = await db.insert(invitedUsers)
    .values({ email: normalizedEmail, role })
    .returning();

  // Send invite email (best-effort — don't fail the request if email fails)
  sendInviteEmail({ toEmail: row.email, role: row.role }).catch(err => {
    console.error("[invite email]", err.message);
  });

  return c.json(row);
});

// POST /api/admin/invites/:id/resend
adminRoutes.post("/invites/:id/resend", async (c) => {
  const id = c.req.param("id");
  const [inv] = await db.select().from(invitedUsers).where(eq(invitedUsers.id, id)).limit(1);
  if (!inv) return c.json({ error: "Invite not found" }, 404);
  sendInviteEmail({ toEmail: inv.email, role: inv.role }).catch(err => {
    console.error("[resend invite email]", err.message);
  });
  return c.json({ ok: true });
});

// DELETE /api/admin/invites/:id
adminRoutes.delete("/invites/:id", async (c) => {
  const id = c.req.param("id");
  await db.delete(invitedUsers).where(eq(invitedUsers.id, id));
  return c.json({ ok: true });
});

// POST /api/admin/test-email — send a test notification email to a given address
adminRoutes.post("/test-email", async (c) => {
  const { to } = await c.req.json();
  if (!to) return c.json({ error: "to is required" }, 400);
  const token = signToken({ userId: "test", role: "holder" });
  try {
    await sendStack3Notification({
      toEmail:   to,
      toName:    "Test User",
      token,
      postId:    "test-post-id",
      postTitle: "Test post — email pipeline check",
      postUrl:   "https://reddit.com",
      subreddit: "test",
      growth:    50,
    });
    return c.json({ ok: true, message: `Email sent to ${to}` });
  } catch (err) {
    return c.json({ ok: false, error: (err as Error).message }, 500);
  }
});

// GET /api/admin/worker-status — returns whether the local worker is alive
adminRoutes.get("/worker-status", async (c) => {
  const { alive, lastSeen } = await getWorkerStatus();
  return c.json({
    alive,
    lastSeen,
    secondsAgo: lastSeen ? Math.floor((Date.now() - lastSeen) / 1_000) : null,
  });
});
