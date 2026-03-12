import Redis from "ioredis";

if (!process.env.REDIS_URL) {
  throw new Error("REDIS_URL environment variable is required");
}

// Main Redis client for BullMQ and general caching
export const redis = new Redis(process.env.REDIS_URL, {
  maxRetriesPerRequest: null, // Required by BullMQ
});

redis.on("connect", () => console.log("✓ Redis connected"));
redis.on("error",   (err) => console.error("Redis error:", err.message));

// Connection options for BullMQ (passed as plain object to avoid ioredis type conflicts)
export const bullConnection = { url: process.env.REDIS_URL } as const;
