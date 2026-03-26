// Shared singleton — tracks when the local worker last pinged the backend.
// In-memory: resets on Railway redeploy, but worker re-pings within 60s.

export let workerLastSeen: number | null = null;

export function markWorkerAlive(): void {
  workerLastSeen = Date.now();
}
