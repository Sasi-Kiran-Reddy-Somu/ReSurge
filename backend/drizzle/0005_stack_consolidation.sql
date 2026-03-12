-- Stack consolidation: merge S2+S3 into single S2 with eval window,
-- rename old S4 (alert) to S3, and reduce alert stack lifetime to 4h.

-- 1. Replace old threshold columns with eval window columns
ALTER TABLE "thresholds" ADD COLUMN "s2_eval_start" integer NOT NULL DEFAULT 7;
ALTER TABLE "thresholds" ADD COLUMN "s2_eval_end"   integer NOT NULL DEFAULT 14;
ALTER TABLE "thresholds" DROP COLUMN IF EXISTS "s2_min_age";
ALTER TABLE "thresholds" DROP COLUMN IF EXISTS "s3_min_age";
ALTER TABLE "thresholds" DROP COLUMN IF EXISTS "s3_growth_pct";

-- 2. Migrate existing posts:
--    Old stack 3 (intermediate Hot) → stack 2 (they re-enter eval window)
--    Old stack 4 (Alert)            → stack 3 (renamed)
UPDATE "posts" SET "stack" = 2 WHERE "stack" = 3 AND "discarded" = false;
UPDATE "posts" SET "stack" = 3 WHERE "stack" = 4 AND "discarded" = false;
