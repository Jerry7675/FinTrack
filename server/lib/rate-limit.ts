import {
  RATE_LIMIT_MAX_REQUESTS,
  RATE_LIMIT_MAX_TRACKED_IPS,
  RATE_LIMIT_WINDOW_MS,
} from '../config.js';

type Entry = {
  timestamps: number[];
  lastSeen: number;
};

const buckets = new Map<string, Entry>();

function pruneOld(entry: Entry, now: number): void {
  const cutoff = now - RATE_LIMIT_WINDOW_MS;
  entry.timestamps = entry.timestamps.filter((t) => t > cutoff);
}

function evictIfNeeded(): void {
  if (buckets.size <= RATE_LIMIT_MAX_TRACKED_IPS) {
    return;
  }
  let oldestKey: string | null = null;
  let oldestSeen = Number.POSITIVE_INFINITY;
  for (const [key, entry] of buckets) {
    if (entry.lastSeen < oldestSeen) {
      oldestSeen = entry.lastSeen;
      oldestKey = key;
    }
  }
  if (oldestKey) {
    buckets.delete(oldestKey);
  }
}

export type RateLimitResult =
  | { allowed: true }
  | { allowed: false; retryAfterSec: number };

export function checkRateLimit(
  clientKey: string,
  now = Date.now()
): RateLimitResult {
  let entry = buckets.get(clientKey);
  if (!entry) {
    entry = { timestamps: [], lastSeen: now };
    buckets.set(clientKey, entry);
  }
  entry.lastSeen = now;
  pruneOld(entry, now);

  if (entry.timestamps.length >= RATE_LIMIT_MAX_REQUESTS) {
    const oldestInWindow = entry.timestamps[0] ?? now;
    const retryMs = RATE_LIMIT_WINDOW_MS - (now - oldestInWindow);
    const retryAfterSec = Math.max(1, Math.ceil(retryMs / 1000));
    return { allowed: false, retryAfterSec };
  }

  entry.timestamps.push(now);
  evictIfNeeded();
  return { allowed: true };
}

/** Test-only: reset in-memory state. */
export function resetRateLimitState(): void {
  buckets.clear();
}

/** Test-only: number of tracked buckets. */
export function rateLimitBucketCount(): number {
  return buckets.size;
}
