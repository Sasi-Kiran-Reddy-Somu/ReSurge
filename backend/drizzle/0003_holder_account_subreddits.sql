-- Add subreddits array to holder_accounts (per-account subreddit tracking)
ALTER TABLE "holder_accounts" ADD COLUMN "subreddits" text[] NOT NULL DEFAULT '{}';

-- Link notifications to a specific holder account
ALTER TABLE "notifications" ADD COLUMN "account_id" uuid;
