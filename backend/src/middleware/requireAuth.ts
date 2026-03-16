import type { Context, Next } from "hono";
import type { AppEnv } from "../types/index.js";
import { verifyToken } from "../lib/auth.js";
import { db } from "../db/client.js";
import { users } from "../db/schema.js";
import { eq } from "drizzle-orm";

export async function requireAuth(c: Context<AppEnv>, next: Next) {
  const header = c.req.header("Authorization") ?? "";
  const token  = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return c.json({ error: "Unauthorized" }, 401);

  const payload = verifyToken(token);
  if (!payload)  return c.json({ error: "Invalid token" }, 401);

  // Verify user still exists (handles admin-deleted users)
  const [user] = await db.select({ id: users.id }).from(users).where(eq(users.id, payload.userId)).limit(1);
  if (!user) return c.json({ error: "Account not found" }, 401);

  c.set("userId", payload.userId);
  c.set("userRole", payload.role);
  await next();
}

export function requireRole(...roles: string[]) {
  return async (c: Context<AppEnv>, next: Next) => {
    const role = c.get("userRole") as string;
    if (!roles.includes(role)) return c.json({ error: "Forbidden" }, 403);
    await next();
  };
}
