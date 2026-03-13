import "dotenv/config";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { sql } from "drizzle-orm";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

import { db } from "./db/client.js";
import { subredditRoutes } from "./routes/subreddits.js";
import { postRoutes }      from "./routes/posts.js";
import { thresholdRoutes } from "./routes/thresholds.js";
import { authRoutes }      from "./routes/auth.js";
import { holderRoutes }    from "./routes/holder.js";
import { monitorRoutes }   from "./routes/monitor.js";
import { adminRoutes }     from "./routes/admin.js";
import { createPollWorker } from "./workers/pollWorker.js";
import { ensureGlobalPollScheduled } from "./lib/queue.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const app = new Hono();

// ── CORS — allow all three frontends ───────────────────────────
const allowedOrigins = [
  process.env.MAIN_APP_URL    ?? "http://localhost:3000",
  process.env.HOLDER_APP_URL  ?? "http://localhost:3002",
  process.env.MONITOR_APP_URL ?? "http://localhost:3003",
];

function isAllowedOrigin(origin: string): boolean {
  if (allowedOrigins.includes(origin)) return true;
  if (origin.endsWith(".vercel.app")) return true;
  if (origin.startsWith("http://localhost:")) return true;
  return false;
}

app.use("*", logger());
app.use("*", cors({
  origin:        (origin) => isAllowedOrigin(origin) ? origin : allowedOrigins[0],
  allowMethods:  ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowHeaders:  ["Content-Type", "Authorization"],
  exposeHeaders: ["Content-Length"],
  maxAge:        600,
  credentials:   true,
}));

// ── Routes ─────────────────────────────────────────────────────
app.route("/api/auth",       authRoutes);
app.route("/api/subreddits", subredditRoutes);
app.route("/api/posts",      postRoutes);
app.route("/api/thresholds", thresholdRoutes);
app.route("/api/holder",     holderRoutes);
app.route("/api/monitor",    monitorRoutes);
app.route("/api/admin",      adminRoutes);

app.get("/health", (c) => c.json({ status: "ok", ts: Date.now() }));

// ── Startup ────────────────────────────────────────────────────
async function bootstrap() {
  console.log("\n🚀 ReSurge — starting up...");

  // Auto-apply any pending DB migrations
  try {
    const migrationsFolder = resolve(__dirname, "../drizzle");
    await migrate(db, { migrationsFolder });
    console.log("✓ DB migrations applied");
  } catch (err) {
    console.error("Migration error:", (err as Error).message);
  }

  // Ensure invited_users table exists (direct fallback — migration may not have run on Railway)
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "invited_users" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "email" text NOT NULL UNIQUE,
        "role" text NOT NULL,
        "invited_at" timestamp NOT NULL DEFAULT now()
      )
    `);
    console.log("✓ invited_users table ready");
  } catch (err) {
    console.error("invited_users table error:", (err as Error).message);
  }

  createPollWorker();
  console.log("✓ Poll worker started");

  await ensureGlobalPollScheduled();

  const port = parseInt(process.env.PORT ?? "3001");
  serve({ fetch: app.fetch, port }, () => {
    console.log(`✓ Hono server running on http://localhost:${port}`);
    console.log("\n  Ready.\n");
  });
}

bootstrap().catch((err) => {
  console.error("Fatal startup error:", err);
  process.exit(1);
});
