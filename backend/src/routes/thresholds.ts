import { Hono } from "hono";
import { db } from "../db/client.js";
import { thresholds, thresholdEdits } from "../db/schema.js";
import { eq, isNull, desc } from "drizzle-orm";

export const thresholdRoutes = new Hono();

const DEFAULTS = {
  s1MinAge:    10,
  s1MinEng:    20,
  s2EvalStart: 7,
  s2EvalEnd:   14,
  s2GrowthPct: 30,
};

// GET /api/thresholds?subreddit=xxx
// Returns subreddit-specific row if found, else falls back to global (subreddit=null)
thresholdRoutes.get("/", async (c) => {
  const sub = c.req.query("subreddit") ?? null;

  let row;
  if (sub) {
    [row] = await db.select().from(thresholds).where(eq(thresholds.subreddit, sub)).limit(1);
  }
  // Fall back to global if no subreddit-specific row found
  if (!row) {
    [row] = await db.select().from(thresholds).where(isNull(thresholds.subreddit)).limit(1);
  }
  if (!row) return c.json(DEFAULTS);
  return c.json(row);
});

// PUT /api/thresholds?subreddit=xxx
// Upserts thresholds for the given subreddit (or global if no subreddit param)
thresholdRoutes.put("/", async (c) => {
  const sub = c.req.query("subreddit") ?? null;
  const body = await c.req.json<{
    s1MinAge?:    number;
    s1MinEng?:    number;
    s2EvalStart?: number;
    s2EvalEnd?:   number;
    s2GrowthPct?: number;
  }>();

  // Find existing row for this subreddit (or global)
  let existing;
  if (sub) {
    [existing] = await db.select().from(thresholds).where(eq(thresholds.subreddit, sub)).limit(1);
  } else {
    [existing] = await db.select().from(thresholds).where(isNull(thresholds.subreddit)).limit(1);
  }

  if (!existing) {
    // Insert new row (copies global defaults + new values)
    const [inserted] = await db
      .insert(thresholds)
      .values({
        subreddit:   sub,
        s1MinAge:    body.s1MinAge    ?? DEFAULTS.s1MinAge,
        s1MinEng:    body.s1MinEng    ?? DEFAULTS.s1MinEng,
        s2EvalStart: body.s2EvalStart ?? DEFAULTS.s2EvalStart,
        s2EvalEnd:   body.s2EvalEnd   ?? DEFAULTS.s2EvalEnd,
        s2GrowthPct: body.s2GrowthPct ?? DEFAULTS.s2GrowthPct,
      })
      .returning();
    return c.json(inserted);
  }

  const [updated] = await db
    .update(thresholds)
    .set({
      ...(body.s1MinAge    !== undefined && { s1MinAge:    body.s1MinAge }),
      ...(body.s1MinEng    !== undefined && { s1MinEng:    body.s1MinEng }),
      ...(body.s2EvalStart !== undefined && { s2EvalStart: body.s2EvalStart }),
      ...(body.s2EvalEnd   !== undefined && { s2EvalEnd:   body.s2EvalEnd }),
      ...(body.s2GrowthPct !== undefined && { s2GrowthPct: body.s2GrowthPct }),
      updatedAt: new Date(),
    })
    .where(eq(thresholds.id, existing.id))
    .returning();

  return c.json(updated);
});

// GET /api/thresholds/edits/all — all edits across every subreddit
thresholdRoutes.get("/edits/all", async (c) => {
  const rows = await db.select().from(thresholdEdits).orderBy(desc(thresholdEdits.editedAt));
  return c.json(rows);
});

// GET /api/thresholds/edits?subreddit=xxx
thresholdRoutes.get("/edits", async (c) => {
  const sub = c.req.query("subreddit") ?? null;
  const rows = sub
    ? await db.select().from(thresholdEdits).where(eq(thresholdEdits.subreddit, sub)).orderBy(desc(thresholdEdits.editedAt))
    : await db.select().from(thresholdEdits).where(isNull(thresholdEdits.subreddit)).orderBy(desc(thresholdEdits.editedAt));
  return c.json(rows);
});

// POST /api/thresholds/edits
thresholdRoutes.post("/edits", async (c) => {
  const { subreddit, before, after, note } = await c.req.json();
  const [row] = await db.insert(thresholdEdits).values({
    subreddit: subreddit ?? null,
    before: JSON.stringify(before),
    after:  JSON.stringify(after),
    note:   note ?? null,
  }).returning();
  return c.json(row);
});
