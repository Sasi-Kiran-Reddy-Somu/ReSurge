import { Worker } from "bullmq";
import { bullConnection } from "../lib/redis.js";
import { fetchNewPostsMulti, refreshPostEngagement } from "../lib/redditFetcher.js";
import { runStackTransitions } from "../lib/stackEngine.js";
import { db } from "../db/client.js";
import { posts, thresholds, subreddits, users, holderAccounts, notifications, commentScores, leaderboardCache } from "../db/schema.js";
import { eq, and, lt, sql, isNull, inArray } from "drizzle-orm";
import { signToken } from "../lib/auth.js";
import { sendStack3Notification } from "../lib/emailer.js";
import { POLL_QUEUE_NAME } from "../lib/queue.js";

/**
 * Global Poll Worker — runs once every 60s and covers ALL active subreddits.
 *
 * Steps:
 *  1. Load all active subreddits + their thresholds from DB
 *  2. Fetch new posts for ALL subreddits in one Reddit API call
 *  3. Insert new posts into Stack 1 (per subreddit)
 *  4. Collect ALL S2 post IDs from ALL subreddits and refresh in one batched call
 *  5. Run stack transitions per subreddit
 *  6. Send notifications for new Stack 3 alerts
 *  7. Expire old Stack 3 posts
 */
function extractCommentId(link: string): { postId: string; commentId: string } | null {
  try {
    const parts = new URL(link).pathname.split("/").filter(Boolean);
    if (parts.length >= 6 && parts[2] === "comments") return { postId: parts[3], commentId: parts[5] };
    return null;
  } catch { return null; }
}

async function fetchCommentScore(postedLink: string): Promise<number | null> {
  const ids = extractCommentId(postedLink);
  if (!ids) return null;
  try {
    const res = await fetch(`https://www.reddit.com/comments/${ids.postId}/_/${ids.commentId}.json?raw_json=1`, {
      headers: { "User-Agent": "ReSurge/1.0" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const data: any = await res.json();
    const children = data[1]?.data?.children;
    return Array.isArray(children) && children.length > 0 ? children[0]?.data?.score ?? null : null;
  } catch { return null; }
}

async function rebuildLeaderboard() {
  console.log("[Leaderboard] Starting daily rebuild...");
  const posted = await db.select({ id: notifications.id, userId: notifications.userId, postedLink: notifications.postedLink, postedAt: notifications.postedAt })
    .from(notifications).where(eq(notifications.status, "posted"));

  // Refresh comment scores
  for (const n of posted) {
    if (!n.postedLink) continue;
    const score = await fetchCommentScore(n.postedLink);
    if (score === null) continue;
    await db.delete(commentScores).where(eq(commentScores.notificationId, n.id));
    await db.insert(commentScores).values({ notificationId: n.id, score, fetchedAt: new Date() });
    await new Promise(r => setTimeout(r, 400));
  }

  const allUsers = await db.select({ id: users.id, name: users.name, role: users.role })
    .from(users).where(and(eq(users.isActive, true), eq(users.isDeleted, false)));
  const relevantUsers = allUsers.filter(u => u.role === "holder" || u.role === "monitor");

  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  for (const user of relevantUsers) {
    const userNotifs = posted.filter(n => n.userId === user.id);
    const totalPosted = userNotifs.length;
    const notifIds = userNotifs.map(n => n.id);
    let totalUpvotes = 0;
    if (notifIds.length > 0) {
      const scores = await db.select({ score: commentScores.score }).from(commentScores).where(inArray(commentScores.notificationId, notifIds));
      totalUpvotes = scores.reduce((sum, s) => sum + s.score, 0);
    }
    const last24hPosted = userNotifs.filter(n => n.postedAt && n.postedAt >= yesterday).length;
    const days = new Set(userNotifs.filter(n => n.postedAt).map(n => n.postedAt!.toISOString().slice(0, 10)));
    const activeDays = days.size;
    const firstPostedAt = userNotifs.filter(n => n.postedAt).map(n => n.postedAt!).sort((a, b) => a.getTime() - b.getTime())[0] ?? null;
    let avgPerDay = 0;
    if (firstPostedAt && totalPosted > 0) {
      const daysSinceFirst = Math.max(1, Math.ceil((now.getTime() - firstPostedAt.getTime()) / (86400 * 1000)));
      avgPerDay = totalPosted / daysSinceFirst;
    }
    const upvoteRate = totalPosted > 0 ? totalUpvotes / totalPosted : 0;
    await db.insert(leaderboardCache).values({ userId: user.id, name: user.name, role: user.role, totalPosted, totalUpvotes, last24hPosted, avgPerDay, upvoteRate, activeDays, firstPostedAt, updatedAt: now })
      .onConflictDoUpdate({ target: leaderboardCache.userId, set: { name: user.name, role: user.role, totalPosted, totalUpvotes, last24hPosted, avgPerDay, upvoteRate, activeDays, firstPostedAt, updatedAt: now } });
  }
  console.log(`[Leaderboard] Rebuilt for ${relevantUsers.length} users.`);
}

export function createPollWorker() {
  const worker = new Worker(
    POLL_QUEUE_NAME,
    async () => {
      const now = Date.now();

      // ── Step 1: Load all active, non-paused subreddits ────
      const activeSubs = await db
        .select({ name: subreddits.name })
        .from(subreddits)
        .where(and(eq(subreddits.isActive, true), eq(subreddits.isPaused, false)));

      if (activeSubs.length === 0) return;

      const subNames = activeSubs.map((s) => s.name);
      console.log(`[Worker] Global poll — ${subNames.length} subreddits: ${subNames.map(n => "r/" + n).join(", ")}`);

      // Load thresholds for each subreddit (fall back to global, then hardcoded defaults)
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

      // ── Step 2: Fetch all new posts in ONE Reddit call ─────
      let fetchedPosts;
      try {
        fetchedPosts = await fetchNewPostsMulti(subNames, 100);
      } catch (err) {
        console.error("[Worker] Fetch failed:", (err as Error).message);
        throw err;
      }

      console.log(`  Fetched ${fetchedPosts.length} total posts from Reddit`);

      // ── Step 3: Insert new posts per subreddit ─────────────
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

      // ── Step 4: Refresh ALL S1+S2 posts from ALL subreddits in ONE call ──
      // S1 needs fresh engagement so the s1MinEng check at transition time uses current data.
      // S2 needs it for growth % calculation. S3 is terminal — no refresh needed.
      const s2Posts = await db
        .select({ id: posts.id, redditId: posts.redditId, subreddit: posts.subreddit })
        .from(posts)
        .where(and(
          inArray(posts.subreddit, subNames),
          eq(posts.discarded, false),
          inArray(posts.stack, [1, 2]),
        ));

      const allRedditIds = s2Posts.map((p) => p.redditId);

      if (allRedditIds.length > 0) {
        const engMap = await refreshPostEngagement(allRedditIds);
        for (const [redditId, eng] of engMap.entries()) {
          await db
            .update(posts)
            .set({ upvotes: eng.upvotes, comments: eng.comments, engagement: eng.engagement, updatedAt: new Date() })
            .where(eq(posts.redditId, redditId));
        }
        console.log(`  Refreshed engagement for ${allRedditIds.length} S1+S2 posts across all subreddits`);
      }

      // ── Steps 5-7: Per-subreddit transitions, alerts, expiry ─
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

        // Notify holders
        if (newStack3Alerts.length > 0) {
          const matchingAccounts = await db
            .select()
            .from(holderAccounts)
            .where(and(sql`${sub} = ANY(${holderAccounts.subreddits})`, eq(holderAccounts.isActive, true)));

          // Deduplicate: one notification per user regardless of how many accounts they have
          const seenHolderIds = new Set<string>();
          const uniqueAccounts = matchingAccounts.filter(a => {
            if (seenHolderIds.has(a.holderId)) return false;
            seenHolderIds.add(a.holderId);
            return true;
          });

          for (const account of uniqueAccounts) {
            const [user] = await db.select().from(users).where(eq(users.id, account.holderId)).limit(1);
            if (!user) continue;
            if (!user.isActive || user.isDeleted) continue;
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
                console.log(`  ✉ Notified ${user.email} about "${post.title}"`);
              } catch (err) {
                const errMsg = (err as Error).message ?? String(err);
                console.error(`  ✗ Email failed for ${user.email}:`, errMsg);
                await db.update(notifications).set({ status: `failed:${errMsg.slice(0, 200)}` }).where(eq(notifications.id, notif.id));
              }
            }
          }
        }

        // Expire Stack 3 posts older than 4 hours
        const stack3Expiry = now - 4 * 60 * 60 * 1000;
        const expireResult = await db
          .update(posts)
          .set({ discarded: true, updatedAt: new Date() })
          .where(and(
            eq(posts.subreddit, sub),
            eq(posts.stack, 3),
            eq(posts.discarded, false),
            lt(posts.alertedAt, stack3Expiry),
          ));

        void expireResult;
        console.log(`  r/${sub} — new: ${newCounts[sub] ?? 0}, alerts: ${newStack3Alerts.length}`);
      }

      // Daily leaderboard rebuild at 09:30 UTC (3pm IST)
      const nowUtc = new Date();
      const utcH = nowUtc.getUTCHours();
      const utcM = nowUtc.getUTCMinutes();
      if (utcH === 9 && utcM >= 30 && utcM < 31) {
        rebuildLeaderboard().catch(err => console.error("[Leaderboard] Error:", (err as Error).message));
      }
    },
    {
      connection: bullConnection,
      concurrency: 1, // single global job, no parallelism needed
    }
  );

  worker.on("completed", (job) => console.log(`  ✓ Global poll job ${job.id} done`));
  worker.on("failed",    (job, err) => console.error(`  ✗ Poll job ${job?.id} failed:`, err.message));

  return worker;
}
