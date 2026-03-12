import { Queue, QueueEvents } from "bullmq";
import { bullConnection } from "./redis.js";

export const POLL_QUEUE_NAME = "reddit-poll";

// Single global poll queue — one repeatable job covers all subreddits
export const pollQueue = new Queue(POLL_QUEUE_NAME, {
  connection: bullConnection,
  defaultJobOptions: {
    removeOnComplete: 50,
    removeOnFail:     100,
    attempts:         3,
    backoff: {
      type:  "exponential",
      delay: 5000,
    },
  },
});

export const pollQueueEvents = new QueueEvents(POLL_QUEUE_NAME, {
  connection: bullConnection,
});

const GLOBAL_JOB_ID = "global-poll";

/**
 * Ensure the single global poll job is scheduled.
 * Safe to call multiple times — idempotent.
 */
export async function ensureGlobalPollScheduled(): Promise<void> {
  const existing = await pollQueue.getRepeatableJobs();
  const already = existing.some((j) => j.id === GLOBAL_JOB_ID);
  if (already) return;

  await pollQueue.add(
    "poll",
    {},
    {
      jobId:  GLOBAL_JOB_ID,
      repeat: { every: 60_000 },
    }
  );
  console.log("✓ Scheduled global poll job (all subreddits, every 60s)");
}
