ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "email_notifications_disabled" boolean NOT NULL DEFAULT false;
