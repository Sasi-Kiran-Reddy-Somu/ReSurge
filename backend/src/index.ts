import "dotenv/config";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";

import { subredditRoutes } from "./routes/subreddits.js";
import { postRoutes }      from "./routes/posts.js";
import { thresholdRoutes } from "./routes/thresholds.js";
import { authRoutes }      from "./routes/auth.js";
import { holderRoutes }    from "./routes/holder.js";
import { monitorRoutes }   from "./routes/monitor.js";
import { adminRoutes }     from "./routes/admin.js";
import { createPollWorker } from "./workers/pollWorker.js";
import { ensureGlobalPollScheduled } from "./lib/queue.js";

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
  allowMethods:  ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
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
