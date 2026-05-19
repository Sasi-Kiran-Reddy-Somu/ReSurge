import { db } from "../db/client.js";
import { notifications, users } from "../db/schema.js";
import { eq, and, gte, isNull, ne, sql } from "drizzle-orm";

export const DAILY_EMAIL_CAP_PER_SUBREDDIT = 5;

export type EmailSkipReason = "daily_cap" | "paused" | "deactivated";

/**
 * Decide whether to send an email for a new notification.
 *
 * Returns either `{ send: true }` or `{ send: false, reason }`.
 *
 * Caller responsibilities:
 * - Always create the notification row first.
 * - If send=false, set `email_skipped_reason = reason` on that row, do not call
 *   the emailer, and do not set status='sent'.
 * - If send=true, call emailer, mark sent/failed as usual.
 *
 * The "deactivated" reason is a defense-in-depth guard — the calling worker
 * should already skip deactivated users earlier, but checking again here
 * ensures emails never go out even if a code path forgets.
 */
export async function shouldSendEmail(opts: {
  userId: string;
  subreddit: string;
  now: number;
}): Promise<{ send: true } | { send: false; reason: EmailSkipReason }> {
  const { userId, subreddit, now } = opts;

  // 1. Re-check user is still active and not deleted.
  const [user] = await db
    .select({
      isActive: users.isActive,
      isDeleted: users.isDeleted,
      notificationsPausedUntil: users.notificationsPausedUntil,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user || user.isDeleted || !user.isActive) {
    return { send: false, reason: "deactivated" };
  }

  // 2. Paused?
  if (user.notificationsPausedUntil && user.notificationsPausedUntil > now) {
    return { send: false, reason: "paused" };
  }

  // 3. Per-subreddit daily cap (UTC calendar day).
  const startOfUtcDay = new Date();
  startOfUtcDay.setUTCHours(0, 0, 0, 0);

  // Count successfully-sent emails today for this (user, subreddit).
  // "Successfully sent" = status NOT like 'failed:%' AND email_skipped_reason IS NULL.
  // failed: rows shouldn't count toward the cap (they didn't actually email anyone).
  // skipped rows shouldn't count either.
  const [{ count }] = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(notifications)
    .where(and(
      eq(notifications.userId, userId),
      eq(notifications.subreddit, subreddit),
      gte(notifications.sentAt, startOfUtcDay),
      isNull(notifications.emailSkippedReason),
      sql`${notifications.status} NOT LIKE 'failed:%'`,
    ));

  if (count >= DAILY_EMAIL_CAP_PER_SUBREDDIT) {
    return { send: false, reason: "daily_cap" };
  }

  return { send: true };
}
