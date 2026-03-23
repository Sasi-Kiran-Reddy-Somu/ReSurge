import { Hono } from "hono";
import { db } from "../db/client.js";
import { users, invitedUsers, monitorAssignments } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { hashPassword, comparePassword, signToken } from "../lib/auth.js";

const ADMIN_EMAILS = ["seo@cubehq.ai", "sasi@cubehq.ai"];

export const authRoutes = new Hono();

// POST /api/auth/signup
authRoutes.post("/signup", async (c) => {
  const { email, password, name, role, phone } = await c.req.json();

  if (!email || !password || !name || !role) {
    return c.json({ error: "email, password, name and role are required" }, 400);
  }
  if (!["monitor", "holder"].includes(role)) {
    return c.json({ error: "Role must be monitor or holder" }, 400);
  }

  const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (existing.length > 0) return c.json({ error: "Email already registered" }, 409);

  const passwordHash = await hashPassword(password);
  const [user] = await db.insert(users).values({
    email, passwordHash, name, role, roles: [role], phone, adminAcknowledged: false
  }).returning();

  const token = signToken({ userId: user.id, role: user.role });
  return c.json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role, roles: user.roles } });
});

// POST /api/auth/login
authRoutes.post("/login", async (c) => {
  const { email, password, loginAs } = await c.req.json();
  if (!email || !password) return c.json({ error: "email and password required" }, 400);

  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!user) return c.json({ error: "Invalid credentials" }, 401);

  const ok = await comparePassword(password, user.passwordHash);
  if (!ok) return c.json({ error: "Invalid credentials" }, 401);

  // If loginAs is specified, check user has that role
  const userRoles = (user.roles && user.roles.length > 0) ? user.roles : [user.role];
  if (loginAs && !userRoles.includes(loginAs)) {
    return c.json({ error: `This account does not have the "${loginAs}" role` }, 403);
  }

  const activeRole = loginAs || user.role;
  const token = signToken({ userId: user.id, role: activeRole });
  return c.json({
    token,
    user: { id: user.id, email: user.email, name: user.name, role: activeRole, roles: userRoles }
  });
});

// GET /api/auth/roles?email=... — returns available roles for an email (without password, for UI hints)
authRoutes.get("/roles", async (c) => {
  const email = c.req.query("email");
  if (!email) return c.json({ roles: [] });
  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!user) return c.json({ roles: [] });
  const roles = (user.roles && user.roles.length > 0) ? user.roles : [user.role];
  return c.json({ roles });
});

// POST /api/auth/google — Google OAuth sign-in (all portals)
authRoutes.post("/google", async (c) => {
  const { credential } = await c.req.json();
  if (!credential) return c.json({ error: "credential required" }, 400);

  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) return c.json({ error: "Google OAuth not configured" }, 500);

  // Verify Google ID token
  const { OAuth2Client } = await import("google-auth-library");
  const client = new OAuth2Client(clientId);
  let payload: any;
  try {
    const ticket = await client.verifyIdToken({ idToken: credential, audience: clientId });
    payload = ticket.getPayload();
  } catch {
    return c.json({ error: "Invalid Google credential" }, 401);
  }

  const email = payload?.email?.toLowerCase();
  const name  = payload?.name ?? email;
  if (!email) return c.json({ error: "No email from Google" }, 400);

  // Determine role
  let role: string;
  let roles: string[];
  let adminAcknowledged = true;

  // Find or create user
  let [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  const isNewSignup = !user;

  if (user) {
    // Check account status before allowing login
    if (user.isDeleted) return c.json({ error: "This account has been deleted. Contact admin." }, 403);
    if (!user.isActive) return c.json({ error: "This account has been deactivated. Contact admin." }, 403);
    // Already registered — use their existing role(s), no invite needed
    const existingRoles = user.roles?.length ? user.roles : [user.role];
    role  = user.role;
    roles = existingRoles;
  } else {
    // New user — check for an explicit invite first
    const [invite] = await db.select().from(invitedUsers).where(eq(invitedUsers.email, email)).limit(1);
    if (invite) {
      // Explicit invite always wins (even for admin emails — allows role changes)
      role  = invite.role;
      roles = [invite.role];
      adminAcknowledged = false;
      await db.delete(invitedUsers).where(eq(invitedUsers.email, email));
    } else if (ADMIN_EMAILS.includes(email)) {
      // No invite — fall back to hardcoded admin for super-admin emails
      role  = "main";
      roles = ["main"];
    } else {
      return c.json({ error: "You haven't been invited. Contact the admin." }, 403);
    }
  }

  if (!user) {
    [user] = await db.insert(users).values({
      email, passwordHash: "", name, role, roles, adminAcknowledged,
    }).returning();
  } else {
    // Ensure the role from invite is present (handles edge case of re-invited user with new role)
    const currentRoles = user.roles?.length ? user.roles : [user.role];
    if (!currentRoles.includes(role)) {
      const merged = [...new Set([...currentRoles, role])];
      [user] = await db.update(users).set({ roles: merged }).where(eq(users.id, user.id)).returning();
    }
  }

  // Monitors are also holders — give them the holder role + self-assignment
  const userRolesNow = user.roles?.length ? user.roles : [user.role];
  if (userRolesNow.includes("monitor") && !userRolesNow.includes("holder")) {
    const merged = [...new Set([...userRolesNow, "holder"])];
    [user] = await db.update(users).set({ roles: merged }).where(eq(users.id, user.id)).returning();
  }
  if (userRolesNow.includes("monitor")) {
    const existing = await db.select().from(monitorAssignments)
      .where(eq(monitorAssignments.monitorId, user.id)).limit(10);
    const selfAssigned = existing.some((a) => a.holderId === user.id);
    if (!selfAssigned) {
      await db.insert(monitorAssignments).values({ monitorId: user.id, holderId: user.id });
    }
  }

  const token = signToken({ userId: user.id, role: user.role });
  return c.json({
    token,
    user:        { id: user.id, email: user.email, name: user.name, role: user.role, roles: user.roles },
    isNewSignup,
  });
});

// POST /api/auth/verify  (validate a token — used by holder app deep links)
authRoutes.post("/verify", async (c) => {
  const { token } = await c.req.json();
  const { verifyToken } = await import("../lib/auth.js");
  const payload = verifyToken(token);
  if (!payload) return c.json({ error: "Invalid token" }, 401);
  const [user] = await db.select().from(users).where(eq(users.id, payload.userId)).limit(1);
  if (!user) return c.json({ error: "Account not found", code: "ACCOUNT_DELETED" }, 401);
  if (user.isDeleted) return c.json({ error: "This account has been deleted. Contact admin.", code: "ACCOUNT_DELETED" }, 401);
  if (!user.isActive) return c.json({ error: "This account has been deactivated. Contact admin.", code: "ACCOUNT_DEACTIVATED" }, 401);
  const roles = (user.roles && user.roles.length > 0) ? user.roles : [user.role];
  return c.json({ user: { id: user.id, email: user.email, name: user.name, role: payload.role, roles } });
});
