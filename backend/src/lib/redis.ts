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

// Separate connection for BullMQ (it needs its own connection)
export const redisForBull = new Redis(process.env.REDIS_URL, {
  maxRetriesPerRequest: null,
});
