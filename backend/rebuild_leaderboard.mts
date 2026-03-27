import 'dotenv/config';
import { db } from './src/db/client.js';
import { notifications, users, commentScores, leaderboardCache } from './src/db/schema.js';
import { eq, and, inArray } from 'drizzle-orm';

function extractCommentId(link: string): { postId: string; commentId: string } | null {
  try {
    const parts = new URL(link).pathname.split('/').filter(Boolean);
    if (parts.length >= 6 && parts[2] === 'comments') return { postId: parts[3], commentId: parts[5] };
    return null;
  } catch { return null; }
}

async function fetchCommentScore(postedLink: string): Promise<number | null> {
  const ids = extractCommentId(postedLink);
  if (!ids) return null;
  try {
    const res = await fetch(`https://www.reddit.com/comments/${ids.postId}/_/${ids.commentId}.json?raw_json=1`, {
      headers: { 'User-Agent': 'ReSurge/1.0' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) { console.log(`  Reddit ${res.status} for comment ${ids.commentId}`); return null; }
    const data: any = await res.json();
    const children = data[1]?.data?.children;
    return Array.isArray(children) && children.length > 0 ? children[0]?.data?.score ?? null : null;
  } catch (e: any) { console.log(`  Fetch error: ${e.message}`); return null; }
}

const posted = await db.select({
  id: notifications.id,
  userId: notifications.userId,
  postedLink: notifications.postedLink,
  postedAt: notifications.postedAt,
}).from(notifications).where(eq(notifications.status, 'posted'));

console.log(`Found ${posted.length} posted notifications`);

let fetched = 0, failed = 0;
for (const n of posted) {
  if (!n.postedLink) continue;
  const score = await fetchCommentScore(n.postedLink);
  if (score === null) { failed++; continue; }
  await db.delete(commentScores).where(eq(commentScores.notificationId, n.id));
  await db.insert(commentScores).values({ notificationId: n.id, score, fetchedAt: new Date() });
  fetched++;
  console.log(`  [${fetched}] score=${score} link=${n.postedLink.slice(0, 80)}`);
  await new Promise(r => setTimeout(r, 400));
}
console.log(`\nScores fetched: ${fetched}, failed/skipped: ${failed}`);

const allUsers = await db.select({ id: users.id, name: users.name, role: users.role })
  .from(users).where(and(eq(users.isActive, true), eq(users.isDeleted, false)));
const relevantUsers = allUsers.filter(u => u.role === 'holder' || u.role === 'monitor');

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
  console.log(`  ${user.name} (${user.role}): posted=${totalPosted} upvotes=${totalUpvotes} last24h=${last24hPosted}`);
}
console.log(`\nLeaderboard rebuilt for ${relevantUsers.length} users.`);
process.exit(0);
