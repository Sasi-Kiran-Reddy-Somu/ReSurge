CREATE TABLE IF NOT EXISTS "comment_scores" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "notification_id" uuid NOT NULL,
  "score" integer NOT NULL DEFAULT 0,
  "fetched_at" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "leaderboard_cache" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL UNIQUE,
  "name" text NOT NULL,
  "role" text NOT NULL,
  "total_posted" integer NOT NULL DEFAULT 0,
  "total_upvotes" integer NOT NULL DEFAULT 0,
  "last24h_posted" integer NOT NULL DEFAULT 0,
  "avg_per_day" real NOT NULL DEFAULT 0,
  "upvote_rate" real NOT NULL DEFAULT 0,
  "active_days" integer NOT NULL DEFAULT 0,
  "first_posted_at" timestamp,
  "updated_at" timestamp NOT NULL DEFAULT now()
);
