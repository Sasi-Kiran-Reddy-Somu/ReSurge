-- Track whether admin has seen/acknowledged a new signup.
-- Defaults to true (existing users + admin-created accounts are already known).
-- Set to false for self-signups via /api/auth/signup so they appear in the Alerts panel.

ALTER TABLE "users" ADD COLUMN "admin_acknowledged" boolean NOT NULL DEFAULT true;
