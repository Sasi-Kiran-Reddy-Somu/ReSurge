-- Create invited_users table for RBAC invite system
CREATE TABLE IF NOT EXISTS "invited_users" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "email" text NOT NULL UNIQUE,
  "role" text NOT NULL,
  "invited_at" timestamp NOT NULL DEFAULT now()
);

-- Allow password_hash to be empty for Google OAuth users (no structural change needed, just document intent)
-- Google OAuth users will have passwordHash = '' stored
