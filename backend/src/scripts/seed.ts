/**
 * Run once to create the main admin account:
 *   npx tsx src/scripts/seed.ts
 */
import "dotenv/config";
import { db } from "../db/client.js";
import { users } from "../db/schema.js";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

const EMAIL    = process.env.SEED_EMAIL    ?? "admin@company.com";
const PASSWORD = process.env.SEED_PASSWORD ?? "admin123";
const NAME     = process.env.SEED_NAME     ?? "Admin";

const existing = await db.select().from(users).where(eq(users.email, EMAIL)).limit(1);
if (existing.length > 0) {
  console.log(`✓ Main account already exists: ${EMAIL}`);
  process.exit(0);
}

const passwordHash = await bcrypt.hash(PASSWORD, 10);
await db.insert(users).values({ email: EMAIL, passwordHash, name: NAME, role: "main" });
console.log(`✓ Created main account: ${EMAIL} / ${PASSWORD}`);
process.exit(0);
