import type { Context, Next } from "hono";
import type { AppEnv } from "../types/index.js";
import { verifyToken } from "../lib/auth.js";

export async function requireAuth(c: Context<AppEnv>, next: Next) {
  const header = c.req.header("Authorization") ?? "";
  const token  = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return c.json({ error: "Unauthorized" }, 401);

  const payload = verifyToken(token);
  if (!payload)  return c.json({ error: "Invalid token" }, 401);

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
