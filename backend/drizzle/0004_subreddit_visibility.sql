ALTER TABLE "subreddits" ADD COLUMN IF NOT EXISTS "visible_to_holders" boolean NOT NULL DEFAULT true;
