-- Add subreddit column to thresholds for per-subreddit threshold support
ALTER TABLE "thresholds" ADD COLUMN IF NOT EXISTS "subreddit" text;
