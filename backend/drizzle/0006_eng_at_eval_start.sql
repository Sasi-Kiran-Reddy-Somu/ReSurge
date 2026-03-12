-- Add snapshot column for engagement at the start of the S2 eval window.
-- This stores the engagement value recorded when a post first crosses s2EvalStart,
-- so growth is measured from the 7-min mark to the 14-min mark (not from S2 entry).

ALTER TABLE "posts" ADD COLUMN "eng_at_eval_start" integer;
