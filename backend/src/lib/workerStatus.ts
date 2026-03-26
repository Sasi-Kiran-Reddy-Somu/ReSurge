// Persists worker heartbeat in Redis so it survives Railway redeploys.
import { redis } from "./redis.js";

const KEY = "worker:last_seen";
const TTL = 60 * 10; // 10 minutes — auto-expires if worker dies

export async function markWorkerAlive(): Promise<void> {
  await redis.set(KEY, Date.now().toString(), "EX", TTL);
}

export async function getWorkerStatus(): Promise<{ alive: boolean; lastSeen: number | null }> {
  const val = await redis.get(KEY);
  if (!val) return { alive: false, lastSeen: null };
  const lastSeen = parseInt(val, 10);
  const alive = Date.now() - lastSeen < 3 * 60 * 1_000;
  return { alive, lastSeen };
}
