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

import { db } from "./db/client.js";
import { posts, thresholds, subreddits, users, holderAccounts, notifications } from "./db/schema.js";
import { fetchNewPostsMulti, refreshPostEngagement } from "./lib/redditFetcher.js";
import { runStackTransitions } from "./lib/stackEngine.js";
import { signToken } from "./lib/auth.js";
import { sendStack4Notification } from "./lib/emailer.js";
import { eq, and, lt, sql, isNull, inArray } from "drizzle-orm";

const POLL_INTERVAL_MS = 60_000;

async function runPoll() {
  const now = Date.now();

  // Step 1: Load all active, non-paused subreddits
  const activeSubs = await db
    .select({ name: subreddits.name })
    .from(subreddits)
    .where(and(eq(subreddits.isActive, true), eq(subreddits.isPaused, false)));

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
    await db.update(subreddits).set({ subscribers: count }).where(eq(subreddits.name, sub));
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
    const engMap = await refreshPostEngagement(allRedditIds);
    for (const [redditId, eng] of engMap.entries()) {
      await db
        .update(posts)
        .set({ upvotes: eng.upvotes, comments: eng.comments, engagement: eng.engagement, updatedAt: new Date() })
        .where(eq(posts.redditId, redditId));
    }
    console.log(`  Refreshed engagement for ${allRedditIds.length} S1+S2 posts`);
  }

  // Steps 5-7: Per-subreddit transitions, alerts, expiry
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
            await sendStack4Notification({
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
            console.error(`  Email failed for ${user.email}:`, (err as Error).message);
          }
        }
      }
    }

    // Expire Stack 3 posts older than 4 hours
    const stack3Expiry = now - 4 * 60 * 60 * 1000;
    await db
      .update(posts)
      .set({ discarded: true, updatedAt: new Date() })
      .where(and(
        eq(posts.subreddit, sub),
        eq(posts.stack, 3),
        eq(posts.discarded, false),
        lt(posts.alertedAt, stack3Expiry),
      ));

    console.log(`  r/${sub} — new: ${newCounts[sub] ?? 0}, alerts: ${newStack3Alerts.length}`);
  }

  console.log(`[Local Worker] Poll complete in ${Date.now() - now}ms`);
}

async function main() {
  console.log("[Local Worker] Starting — polling Reddit every 60s from your home IP");
  console.log(`[Local Worker] DB: ${process.env.DATABASE_URL?.slice(0, 40)}...`);

  // Fire immediately and schedule every 60s concurrently so the interval
  // isn't delayed by however long the first poll takes.
  runPoll().catch((err) => console.error("[Local Worker] Poll error:", (err as Error).message));
  setInterval(() => {
    runPoll().catch((err) => console.error("[Local Worker] Unhandled error in poll cycle:", (err as Error).message));
  }, POLL_INTERVAL_MS);
}

main().catch((err) => {
  console.error("[Local Worker] Fatal error:", err);
  process.exit(1);
});
