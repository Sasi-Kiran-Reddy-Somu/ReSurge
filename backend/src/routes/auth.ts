import { Hono } from "hono";
import { db } from "../db/client.js";
import { users } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { hashPassword, comparePassword, signToken } from "../lib/auth.js";

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

// POST /api/auth/verify  (validate a token — used by holder app deep links)
authRoutes.post("/verify", async (c) => {
  const { token } = await c.req.json();
  const { verifyToken } = await import("../lib/auth.js");
  const payload = verifyToken(token);
  if (!payload) return c.json({ error: "Invalid token" }, 401);
  const [user] = await db.select().from(users).where(eq(users.id, payload.userId)).limit(1);
  if (!user) return c.json({ error: "User not found" }, 404);
  const roles = (user.roles && user.roles.length > 0) ? user.roles : [user.role];
  return c.json({ user: { id: user.id, email: user.email, name: user.name, role: payload.role, roles } });
});
