import { db } from "./client.js";
import { thresholds, subreddits } from "./schema.js";

/**
 * Run this once after running migrations to seed default data.
 * npx tsx src/db/seed.ts
 */
async function seed() {
  console.log("Seeding database...");

  // Insert default thresholds row (only if empty)
  const existing = await db.select().from(thresholds).limit(1);
  if (existing.length === 0) {
    await db.insert(thresholds).values({
      s1MinAge:    10,
      s1MinEng:    20,
      s2EvalStart: 7,
      s2EvalEnd:   14,
      s2GrowthPct: 30,
    });
    console.log("✓ Default thresholds inserted");
  } else {
    console.log("  Thresholds already exist, skipping");
  }

  // Insert starter subreddits
  const starters = ["entrepreneur", "startups"];
  for (const name of starters) {
    try {
      await db.insert(subreddits).values({ name }).onConflictDoNothing();
      console.log(`✓ Subreddit r/${name} added`);
    } catch {
      console.log(`  r/${name} already exists`);
    }
  }

  console.log("Seed complete.");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
