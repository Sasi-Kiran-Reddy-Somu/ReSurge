ALTER TABLE "subreddits" ADD COLUMN IF NOT EXISTS "is_paused" boolean NOT NULL DEFAULT false;
