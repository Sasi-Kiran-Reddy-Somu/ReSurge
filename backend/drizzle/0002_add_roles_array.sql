ALTER TABLE "users" ADD COLUMN "roles" text[] NOT NULL DEFAULT '{}';
--> statement-breakpoint
UPDATE "users" SET "roles" = ARRAY["role"];
