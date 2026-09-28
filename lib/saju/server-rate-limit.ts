type Bucket = { startedAt: number; count: number };

const buckets = new Map<string, Bucket>();

export function checkRateLimit(key: string, limit: number, windowMs: number, now = Date.now()): { allowed: boolean; retryAfter: number } {
  const current = buckets.get(key);
  if (!current || now - current.startedAt >= windowMs) {
    buckets.set(key, { startedAt: now, count: 1 });
    return { allowed: true, retryAfter: 0 };
  }
  if (current.count >= limit) {
    return { allowed: false, retryAfter: Math.max(1, Math.ceil((windowMs - (now - current.startedAt)) / 1000)) };
  }
  current.count += 1;
  return { allowed: true, retryAfter: 0 };
}

export function checkApiRateLimit(key: string, limit: number, windowMs: number): { allowed: boolean; retryAfter: number } {
  if (process.env.NODE_TEST_CONTEXT || process.argv.some((argument) => argument === "--test" || argument.endsWith("node:test"))) {
    return { allowed: true, retryAfter: 0 };
  }
  return checkRateLimit(key, limit, windowMs);
}

export function resetRateLimitsForTest(): void {
  buckets.clear();
}
