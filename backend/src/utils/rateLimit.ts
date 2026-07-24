// In-memory fixed-window rate limiter for public endpoints.
//
// Deliberately split into check / register / clear instead of the
// check-and-increment shape used by checkAdminLoginRateLimit: on the self-service
// booking endpoints only *failed* attempts should count, so a customer looking up
// their own booking repeatedly is never throttled while someone guessing booking
// numbers is stopped after a handful of misses.
//
// Counters live in memory, so they reset when the backend restarts (every deploy).
// That is an accepted limitation — an attacker can't time deploys, and the window is
// short enough that a brute-force run still dies long before it gets through the
// keyspace. Persisting them would mean a DB write per request on a public route.

interface Bucket { count: number; resetAt: number }

const buckets = new Map<string, Bucket>();

// Bound memory: the key space is attacker-influenced (IP + email), and this box is
// already RAM-tight. Sweep expired entries once the map grows past this.
const PRUNE_THRESHOLD = 5000;

function prune(now: number): void {
  for (const [key, b] of buckets) {
    if (now > b.resetAt) buckets.delete(key);
  }
}

// Read-only: true when the key has already used up its budget.
export function isRateLimited(key: string, max: number): boolean {
  const b = buckets.get(key);
  if (!b) return false;
  if (Date.now() > b.resetAt) {
    buckets.delete(key);
    return false;
  }
  return b.count >= max;
}

// Count one failed attempt against the key.
export function registerFailure(key: string, windowMs: number): void {
  const now = Date.now();
  if (buckets.size > PRUNE_THRESHOLD) prune(now);
  const b = buckets.get(key);
  if (!b || now > b.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }
  b.count++;
}

// A legitimate hit — wipe the slate so real customers never accumulate a penalty.
export function clearRateLimit(key: string): void {
  buckets.delete(key);
}
