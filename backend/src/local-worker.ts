/**
 * Local Poll Worker — run this on your home machine instead of Railway.
 *
 * Your home WiFi IP makes all Reddit requests, avoiding the 403 blocks
 * that Railway's datacenter IP triggers.
 *
 * Usage:
 *   1. Create backend/.env with: DATABASE_URL, JWT_SECRET, RESEND_API_KEY, APP_URL
 *   2. From the backend/ directory run:
 *        npx tsx src/local-worker.ts
 *   3. Keep terminal open. Ctrl+C to stop.
 *
 * On Railway: set DISABLE_POLL_WORKER=true so Railway runs API only.
 */

import "dotenv/config";
import fs from "fs";
import path from "path";

const LOCK_FILE = "/tmp/local-worker.pid";

// Exit if another instance is already running
if (fs.existsSync(LOCK_FILE)) {
  const existingPid = parseInt(fs.readFileSync(LOCK_FILE, "utf8").trim(), 10);
  try {
    process.kill(existingPid, 0); // 0 = just check, don't actually kill
    console.error(`[Local Worker] Already running (PID ${existingPid}). Exiting.`);
    process.exit(1);
  } catch {
    // PID is stale — previous instance died without cleaning up
    fs.unlinkSync(LOCK_FILE);
  }
}

fs.writeFileSync(LOCK_FILE, String(process.pid));
const cleanup = () => { try { fs.unlinkSync(LOCK_FILE); } catch {} };
process.on("exit", cleanup);
process.on("SIGINT", () => { cleanup(); process.exit(0); });
process.on("SIGTERM", () => { cleanup(); process.exit(0); });

// Validate required env vars before starting — fail loud rather than silently
const REQUIRED_ENV = ["DATABASE_URL", "JWT_SECRET", "RESEND_API_KEY", "FROM_EMAIL", "APP_URL"];
const missing = REQUIRED_ENV.filter(k => !process.env[k]);
if (missing.length > 0) {
  console.error(`[Local Worker] Missing required env vars: ${missing.join(", ")}`);
  console.error(`[Local Worker] Add them to backend/.env and restart.`);
  process.exit(1);
}

import { db } from "./db/client.js";
import { posts, thresholds, subreddits, users, holderAccounts, notifications, commentScores, leaderboardCache } from "./db/schema.js";
import { fetchNewPostsMulti, refreshPostEngagement } from "./lib/redditFetcher.js";
import { runStackTransitions } from "./lib/stackEngine.js";
import { signToken } from "./lib/auth.js";
import { sendStack3Notification } from "./lib/emailer.js";
import { eq, and, lt, sql, isNull, inArray, desc } from "drizzle-orm";

const POLL_INTERVAL_MS = 60_000;

let lastLeaderboardRun: string | null = null; // tracks date string of last run

// Track email failures across a poll cycle: errorMessage → list of recipient emails
type FailureMap = Map<string, string[]>;

async function sendErrorSummaryEmail(failures: FailureMap) {
  if (failures.size === 0) return;
  const { Resend } = await import("resend");
  const resend = new Resend(process.env.RESEND_API_KEY!);
  const from = process.env.FROM_EMAIL!;

  const rows = [...failures.entries()]
    .map(([msg, emails]) =>
      `<tr>
        <td style="padding:8px 12px;border-bottom:1px solid #1F2937;color:#F87171;">${emails.length}x</td>
        <td style="padding:8px 12px;border-bottom:1px solid #1F2937;color:#9CA3AF;">${emails.join(", ")}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #1F2937;color:#6B7280;font-size:12px;">${msg}</td>
      </tr>`
    )
    .join("");

  const html = `<!DOCTYPE html><html><body style="background:#0D0F16;font-family:monospace;padding:32px;">
    <h2 style="color:#F87171;">Worker email failures</h2>
    <p style="color:#9CA3AF;">${new Date().toUTCString()}</p>
    <table style="border-collapse:collapse;width:100%;background:#0F1117;border:1px solid #1F2937;border-radius:8px;">
      <thead><tr>
        <th style="padding:8px 12px;text-align:left;color:#6B7280;font-size:11px;">COUNT</th>
        <th style="padding:8px 12px;text-align:left;color:#6B7280;font-size:11px;">RECIPIENTS</th>
        <th style="padding:8px 12px;text-align:left;color:#6B7280;font-size:11px;">ERROR</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </body></html>`;

  const { error } = await resend.emails.send({
    from: `ReSurge Worker <${from}>`,
    to: from,
    subject: `Worker: ${failures.size} email error(s) in last poll`,
    html,
  });
  if (error) console.warn("[Local Worker] Could not send error summary email:", error.message);
  else console.warn(`[Local Worker] Sent error summary email (${failures.size} distinct error(s))`);
}

async function runPoll() {
  const now = Date.now();
  const emailFailures: FailureMap = new Map();

  // Step 1: Load all active, non-paused subreddits
  let activeSubs;
  try {
    activeSubs = await db
      .select({ name: subreddits.name })
      .from(subreddits)
      .where(and(eq(subreddits.isActive, true), eq(subreddits.isPaused, false)));
  } catch (err) {
    console.error("[Local Worker] DB error loading subreddits — skipping cycle:", (err as Error).message);
    return;
  }

  if (activeSubs.length === 0) {
    console.log("[Local Worker] No active subreddits — skipping.");
    return;
  }

  const subNames = activeSubs.map((s) => s.name);
  console.log(`[Local Worker] Polling ${subNames.length} subreddits: ${subNames.map(n => "r/" + n).join(", ")}`);

  // Load thresholds
  const [globalThresh] = await db.select().from(thresholds).where(isNull(thresholds.subreddit)).limit(1);
  const subThreshRows  = await db.select().from(thresholds).where(inArray(thresholds.subreddit as any, subNames));

  const threshMap = new Map<string, typeof globalThresh>();
  for (const row of subThreshRows) {
    if (row.subreddit) threshMap.set(row.subreddit, row);
  }

  function getThresh(sub: string) {
    return threshMap.get(sub) ?? globalThresh ?? {
      s1MinAge: 10, s1MinEng: 20, s2EvalStart: 7, s2EvalEnd: 14, s2GrowthPct: 30,
    } as any;
  }

  // Step 2: Fetch new posts
  let fetchedPosts;
  try {
    fetchedPosts = await fetchNewPostsMulti(subNames, 100);
  } catch (err) {
    console.error("[Local Worker] Fetch failed:", (err as Error).message);
    return;
  }

  console.log(`  Fetched ${fetchedPosts.length} total posts from Reddit`);

  // Update subscriber counts from post data (each post includes subreddit_subscribers)
  const subscriberMap = new Map<string, number>();
  for (const rp of fetchedPosts) {
    const sub = (rp.subreddit as string)?.toLowerCase();
    if (sub && rp.subreddit_subscribers && !subscriberMap.has(sub)) {
      subscriberMap.set(sub, rp.subreddit_subscribers);
    }
  }
  for (const [sub, count] of subscriberMap.entries()) {
    try {
      await db.update(subreddits).set({ subscribers: count }).where(eq(subreddits.name, sub));
    } catch { /* non-critical — don't abort the cycle */ }
  }

  // Step 3: Insert new posts
  const MAX_POST_AGE_MS = 2 * 60 * 60 * 1000;
  const newCounts: Record<string, number> = {};

  for (const rp of fetchedPosts) {
    if (rp.created_utc * 1000 < now - MAX_POST_AGE_MS) continue;
    const sub = (rp.subreddit as string).toLowerCase();
    if (!subNames.includes(sub)) continue;
    try {
      await db.insert(posts).values({
        redditId:        rp.id,
        subreddit:       sub,
        title:           rp.title,
        url:             `https://reddit.com${rp.permalink}`,
        author:          rp.author || "",
        selftext:        (rp.selftext || "").slice(0, 500),
        upvotes:         rp.score,
        comments:        rp.num_comments,
        engagement:      rp.score + rp.num_comments,
        redditCreatedAt: rp.created_utc * 1000,
        stack:           1,
        stackEnteredAt:  now,
        engAtStackEntry: rp.score + rp.num_comments,
      }).onConflictDoNothing();
      newCounts[sub] = (newCounts[sub] ?? 0) + 1;
    } catch { /* conflict = already in DB */ }
  }

  // Step 4: Refresh all S1+S2 engagement
  const s1s2Posts = await db
    .select({ id: posts.id, redditId: posts.redditId, subreddit: posts.subreddit })
    .from(posts)
    .where(and(
      inArray(posts.subreddit, subNames),
      eq(posts.discarded, false),
      inArray(posts.stack, [1, 2]),
    ));

  const allRedditIds = s1s2Posts.map((p) => p.redditId);

  if (allRedditIds.length > 0) {
    try {
      const engMap = await refreshPostEngagement(allRedditIds);
      for (const [redditId, eng] of engMap.entries()) {
        try {
          await db
            .update(posts)
            .set({ upvotes: eng.upvotes, comments: eng.comments, engagement: eng.engagement, updatedAt: new Date() })
            .where(eq(posts.redditId, redditId));
        } catch { /* non-critical — skip this post */ }
      }
      console.log(`  Refreshed engagement for ${allRedditIds.length} S1+S2 posts`);
    } catch (err) {
      console.error("[Local Worker] Engagement refresh failed — continuing:", (err as Error).message);
    }
  }

  // Steps 5-7: Per-subreddit transitions, alerts, expiry
  // Pass 1: stack transitions + notification emails — alert fires as soon as this finishes
  const alertCounts: Record<string, number> = {};
  for (const sub of subNames) {
    const thresh = getThresh(sub);
    const threshObj = {
      s1MinAge:    thresh.s1MinAge,
      s1MinEng:    thresh.s1MinEng,
      s2EvalStart: thresh.s2EvalStart,
      s2EvalEnd:   thresh.s2EvalEnd,
      s2GrowthPct: thresh.s2GrowthPct,
    };

    const newStack3Alerts = await runStackTransitions(sub, threshObj);
    alertCounts[sub] = newStack3Alerts.length;

    if (newStack3Alerts.length > 0) {
      const matchingAccounts = await db
        .select()
        .from(holderAccounts)
        .where(sql`${sub} = ANY(${holderAccounts.subreddits})`);

      for (const account of matchingAccounts) {
        const [user] = await db.select().from(users).where(eq(users.id, account.holderId)).limit(1);
        if (!user) continue;
        const userRoles = (user.roles && user.roles.length > 0) ? user.roles : [user.role];
        if (!userRoles.includes("holder") && !userRoles.includes("monitor")) continue;

        for (const postId of newStack3Alerts) {
          const [post] = await db.select().from(posts).where(eq(posts.id, postId)).limit(1);
          if (!post) continue;

          const [notif] = await db.insert(notifications).values({
            userId:    user.id,
            postId:    post.id,
            subreddit: post.subreddit,
            postTitle: post.title,
            postUrl:   post.url,
            accountId: account.id,
          }).returning();

          // Skip email if user has paused notifications
          if (user.notificationsPausedUntil && user.notificationsPausedUntil > now) {
            console.log(`  Notifications paused for ${user.email} (${Math.round((user.notificationsPausedUntil - now) / 60000)}m left)`);
            continue;
          }

          const notifRole = userRoles.includes("monitor") ? "monitor" : "holder";
          const token = signToken({ userId: user.id, role: notifRole });
          try {
            await sendStack3Notification({
              toEmail:   user.email,
              toName:    user.name,
              token,
              postId:    notif.id,
              postTitle: post.title,
              postUrl:   post.url,
              subreddit: post.subreddit,
              growth:    post.lastGrowth ?? 0,
            });
            console.log(`  Notified ${user.email} about "${post.title}"`);
          } catch (err) {
            const msg = (err as Error).message;
            console.error(`  Email failed for ${user.email}:`, msg);
            const existing = emailFailures.get(msg) ?? [];
            emailFailures.set(msg, [...existing, user.email]);
            await db.update(notifications).set({ status: `failed:${msg.slice(0, 200)}` }).where(eq(notifications.id, notif.id));
          }
        }
      }
    }
  }

  // Send failure alert immediately — all notification attempts across all subs are done
  await sendErrorSummaryEmail(emailFailures);

  // Pass 2: expiry + logging (runs after alert is sent)
  const stack3Expiry = now - 4 * 60 * 60 * 1000;
  for (const sub of subNames) {
    await db
      .update(posts)
      .set({ discarded: true, updatedAt: new Date() })
      .where(and(
        eq(posts.subreddit, sub),
        eq(posts.stack, 3),
        eq(posts.discarded, false),
        lt(posts.alertedAt, stack3Expiry),
      ));

    console.log(`  r/${sub} — new: ${newCounts[sub] ?? 0}, alerts: ${alertCounts[sub] ?? 0}`);
  }

  console.log(`[Local Worker] Poll complete in ${Date.now() - now}ms`);

  // Ping Railway backend so the frontend can show worker liveness
  try {
    await fetch(`${process.env.APP_URL}/api/internal/heartbeat`, {
      method: "POST",
      headers: { "X-Worker-Secret": process.env.JWT_SECRET! },
      signal: AbortSignal.timeout(5_000),
    });
  } catch { /* non-critical — don't abort on network hiccup */ }
}

// ── Parse Reddit comment ID from a posted link ─────────────────
function extractCommentId(postedLink: string): { postId: string; commentId: string } | null {
  try {
    const url = new URL(postedLink);
    const parts = url.pathname.split("/").filter(Boolean);
    // /r/{sub}/comments/{postId}/{title}/{commentId}
    if (parts.length >= 6 && parts[2] === "comments") {
      return { postId: parts[3], commentId: parts[5] };
    }
    return null;
  } catch {
    return null;
  }
}

// ── Fetch current upvote score for a comment via Reddit public JSON ──
async function fetchCommentScore(postedLink: string): Promise<number | null> {
  const ids = extractCommentId(postedLink);
  if (!ids) return null;
  try {
    const apiUrl = `https://www.reddit.com/comments/${ids.postId}/_/${ids.commentId}.json?raw_json=1`;
    const res = await fetch(apiUrl, {
      headers: { "User-Agent": "ReSurge/1.0 (leaderboard upvote tracker)" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const data: any = await res.json();
    const comments = data[1]?.data?.children;
    if (Array.isArray(comments) && comments.length > 0) {
      return comments[0]?.data?.score ?? null;
    }
    return null;
  } catch {
    return null;
  }
}

// ── Rebuild leaderboard cache ─────────────────────────────────────
async function rebuildLeaderboard() {
  console.log("[Leaderboard] Starting daily rebuild...");

  // 1. Get all posted notifications with links
  const posted = await db
    .select({
      id: notifications.id,
      userId: notifications.userId,
      postedLink: notifications.postedLink,
      postedAt: notifications.postedAt,
    })
    .from(notifications)
    .where(and(eq(notifications.status, "posted")));

  // 2. Fetch upvote scores for each (with delay to avoid rate limiting)
  for (const n of posted) {
    if (!n.postedLink) continue;
    const score = await fetchCommentScore(n.postedLink);
    if (score === null) continue;
    // Upsert score — delete old + insert new
    await db.delete(commentScores).where(eq(commentScores.notificationId, n.id));
    await db.insert(commentScores).values({ notificationId: n.id, score, fetchedAt: new Date() });
    await new Promise(r => setTimeout(r, 500)); // 500ms between requests
  }

  // 3. Get all active holders and monitors
  const allUsers = await db
    .select({ id: users.id, name: users.name, role: users.role })
    .from(users)
    .where(and(eq(users.isActive, true), eq(users.isDeleted, false)));

  const relevantUsers = allUsers.filter(u => u.role === "holder" || u.role === "monitor");

  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  // 4. Build stats for each user
  for (const user of relevantUsers) {
    const userNotifs = posted.filter(n => n.userId === user.id);
    const totalPosted = userNotifs.length;

    // Sum upvotes from comment_scores for this user's notifications
    const notifIds = userNotifs.map(n => n.id);
    let totalUpvotes = 0;
    if (notifIds.length > 0) {
      const scores = await db
        .select({ score: commentScores.score })
        .from(commentScores)
        .where(inArray(commentScores.notificationId, notifIds));
      totalUpvotes = scores.reduce((sum, s) => sum + s.score, 0);
    }

    const last24hPosted = userNotifs.filter(n => n.postedAt && n.postedAt >= yesterday).length;

    // Active days = distinct calendar days with at least 1 post
    const days = new Set(
      userNotifs
        .filter(n => n.postedAt)
        .map(n => n.postedAt!.toISOString().slice(0, 10))
    );
    const activeDays = days.size;

    const firstPostedAt = userNotifs
      .filter(n => n.postedAt)
      .map(n => n.postedAt!)
      .sort((a, b) => a.getTime() - b.getTime())[0] ?? null;

    let avgPerDay = 0;
    if (firstPostedAt && totalPosted > 0) {
      const daysSinceFirst = Math.max(1, Math.ceil((now.getTime() - firstPostedAt.getTime()) / (86400 * 1000)));
      avgPerDay = totalPosted / daysSinceFirst;
    }

    const upvoteRate = totalPosted > 0 ? totalUpvotes / totalPosted : 0;

    // Upsert into leaderboard_cache
    await db
      .insert(leaderboardCache)
      .values({
        userId: user.id,
        name: user.name,
        role: user.role,
        totalPosted,
        totalUpvotes,
        last24hPosted,
        avgPerDay,
        upvoteRate,
        activeDays,
        firstPostedAt,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: leaderboardCache.userId,
        set: {
          name: user.name,
          role: user.role,
          totalPosted,
          totalUpvotes,
          last24hPosted,
          avgPerDay,
          upvoteRate,
          activeDays,
          firstPostedAt,
          updatedAt: now,
        },
      });
  }

  console.log(`[Leaderboard] Rebuilt for ${relevantUsers.length} users.`);
  lastLeaderboardRun = now.toDateString();
}

async function sendStartupEmail() {
  const { Resend } = await import("resend");
  const resend = new Resend(process.env.RESEND_API_KEY!);
  const from = process.env.FROM_EMAIL!;
  const { error } = await resend.emails.send({
    from: `ReSurge Worker <${from}>`,
    to: from, // always send to yourself
    subject: "Local Worker started",
    html: `<p>The local poll worker started at ${new Date().toUTCString()}.</p><p>Emails will be sent from <strong>${from}</strong>.</p>`,
  });
  if (error) console.warn("[Local Worker] Startup email failed:", error.message);
  else console.log(`[Local Worker] Startup confirmation email sent to ${from}`);
}

async function main() {
  console.log("[Local Worker] Starting — polling Reddit every 60s from your home IP");
  console.log(`[Local Worker] DB: ${process.env.DATABASE_URL?.slice(0, 40)}...`);

  await sendStartupEmail();

  // Fire immediately and schedule every 60s concurrently so the interval
  // isn't delayed by however long the first poll takes.
  runPoll().catch((err) => console.error("[Local Worker] Poll error:", (err as Error).message));
  setInterval(() => {
    runPoll().catch((err) => console.error("[Local Worker] Unhandled error in poll cycle:", (err as Error).message));

    // Daily leaderboard rebuild at 09:30 UTC (3pm IST)
    const nowUtc = new Date();
    const utcH = nowUtc.getUTCHours();
    const utcM = nowUtc.getUTCMinutes();
    if (utcH === 9 && utcM >= 30 && utcM < 31 && lastLeaderboardRun !== nowUtc.toDateString()) {
      rebuildLeaderboard().catch(err => console.error("[Leaderboard] Error:", err.message));
    }
  }, POLL_INTERVAL_MS);
}

main().catch((err) => {
  console.error("[Local Worker] Fatal error:", err);
  process.exit(1);
});
