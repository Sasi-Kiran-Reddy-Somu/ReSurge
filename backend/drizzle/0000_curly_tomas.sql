CREATE TABLE "generated_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"post_id" text NOT NULL,
	"provider" text NOT NULL,
	"suggestions" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reddit_id" text NOT NULL,
	"subreddit" text NOT NULL,
	"title" text NOT NULL,
	"url" text NOT NULL,
	"author" text DEFAULT '' NOT NULL,
	"selftext" text DEFAULT '' NOT NULL,
	"upvotes" integer DEFAULT 0 NOT NULL,
	"comments" integer DEFAULT 0 NOT NULL,
	"engagement" integer DEFAULT 0 NOT NULL,
	"reddit_created_at" bigint NOT NULL,
	"stack_entered_at" bigint NOT NULL,
	"stack" integer DEFAULT 1 NOT NULL,
	"eng_at_stack_entry" integer DEFAULT 0 NOT NULL,
	"last_growth" real,
	"alerted_at" bigint,
	"discarded" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "posts_reddit_id_unique" UNIQUE("reddit_id")
);
--> statement-breakpoint
CREATE TABLE "subreddits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"added_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "subreddits_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "thresholds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"s1_min_age" integer DEFAULT 10 NOT NULL,
	"s1_min_eng" integer DEFAULT 20 NOT NULL,
	"s2_min_age" integer DEFAULT 7 NOT NULL,
	"s2_growth_pct" real DEFAULT 30 NOT NULL,
	"s3_min_age" integer DEFAULT 7 NOT NULL,
	"s3_growth_pct" real DEFAULT 50 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "posts_subreddit_idx" ON "posts" USING btree ("subreddit");--> statement-breakpoint
CREATE INDEX "posts_stack_idx" ON "posts" USING btree ("stack");--> statement-breakpoint
CREATE INDEX "posts_discarded_idx" ON "posts" USING btree ("discarded");