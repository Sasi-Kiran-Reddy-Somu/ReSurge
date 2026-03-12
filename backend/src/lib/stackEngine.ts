import type { Thresholds } from "../types/index.js";
import { db } from "../db/client.js";
import { posts } from "../db/schema.js";
import { eq, and, lt } from "drizzle-orm";

/**
 * Run stack transition checks for all non-discarded posts
 * in stacks 1 and 2 for a given subreddit.
 *
 * Stack system:
 *   S1 → S2: post age >= s1MinAge AND engagement >= s1MinEng
 *   S2 snapshot: at s2EvalStart, record engAtEvalStart
 *   S2 → S3: at s2EvalEnd, growth from snapshot >= s2GrowthPct  (ALERT)
 *   S2 → discard: at s2EvalEnd, growth from snapshot < s2GrowthPct
 *   S3: terminal alert stack — no further transitions (expires via pollWorker at 4h)
 *
 * Returns IDs of posts that reached Stack 3 (for alerting).
 */
export async function runStackTransitions(
  subreddit: string,
  thresh: Thresholds
): Promise<string[]> {
  const now = Date.now();
  const newStack3Ids: string[] = [];

  // Load all active posts for this subreddit in stacks 1 and 2
  const activePosts = await db
    .select()
    .from(posts)
    .where(
      and(
        eq(posts.subreddit, subreddit),
        eq(posts.discarded, false),
        lt(posts.stack, 3)
      )
    );

  for (const post of activePosts) {
    const ageInStackMin = (now - Number(post.stackEnteredAt)) / 60_000;

    if (post.stack === 1) {
      if (ageInStackMin >= thresh.s1MinAge) {
        if (post.engagement >= thresh.s1MinEng) {
          // ✅ Advance to Stack 2 — evaluation window starts
          await db
            .update(posts)
            .set({
              stack:           2,
              stackEnteredAt:  now,
              engAtStackEntry: post.engagement,
              updatedAt:       new Date(),
            })
            .where(eq(posts.id, post.id));
        } else {
          // ❌ Discard — didn't meet engagement threshold
          await db
            .update(posts)
            .set({ discarded: true, updatedAt: new Date() })
            .where(eq(posts.id, post.id));
        }
      }

    } else if (post.stack === 2) {
      if (ageInStackMin >= thresh.s2EvalEnd) {
        // Eval window closed — compare snapshot (at s2EvalStart) to current engagement
        const baseline = post.engAtEvalStart ?? post.engAtStackEntry;
        const growth   = calcGrowthPct(baseline, post.engagement);

        if (growth >= thresh.s2GrowthPct) {
          // ✅ Advance to Stack 3 — ALERT!
          await db
            .update(posts)
            .set({
              stack:           3,
              stackEnteredAt:  now,
              engAtStackEntry: post.engagement,
              lastGrowth:      growth,
              alertedAt:       now,
              updatedAt:       new Date(),
            })
            .where(eq(posts.id, post.id));

          newStack3Ids.push(post.id);
        } else {
          // ❌ Didn't hit growth threshold by end of eval window — discard
          await db
            .update(posts)
            .set({ discarded: true, updatedAt: new Date() })
            .where(eq(posts.id, post.id));
        }

      } else if (ageInStackMin >= thresh.s2EvalStart && post.engAtEvalStart == null) {
        // Eval window just opened — record engagement snapshot at this mark
        await db
          .update(posts)
          .set({ engAtEvalStart: post.engagement, updatedAt: new Date() })
          .where(eq(posts.id, post.id));
      }
      // else: before eval window, or snapshot already recorded — no action
    }
  }

  return newStack3Ids;
}

export function calcGrowthPct(prev: number, curr: number): number {
  if (!prev || prev === 0) return 0;
  return ((curr - prev) / prev) * 100;
}
