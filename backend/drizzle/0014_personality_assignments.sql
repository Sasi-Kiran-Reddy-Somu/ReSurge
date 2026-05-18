CREATE TABLE IF NOT EXISTS "post_personality_assignments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "post_id" text NOT NULL,
  "user_id" text NOT NULL,
  "personality_id" text NOT NULL,
  "assigned_at" timestamp NOT NULL DEFAULT now(),
  "was_fallback" boolean NOT NULL DEFAULT false,
  CONSTRAINT "post_personality_assignments_post_user_unique" UNIQUE ("post_id", "user_id")
);

CREATE INDEX IF NOT EXISTS "ppa_post_idx" ON "post_personality_assignments" ("post_id");
CREATE INDEX IF NOT EXISTS "ppa_user_idx" ON "post_personality_assignments" ("user_id");
