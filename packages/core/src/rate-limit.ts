const hits = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(
  key: string,
  maxRequests: number,
  windowMs: number,
): { allowed: boolean; remaining: number; resetIn: number } {
  const now = Date.now();
  const record = hits.get(key);

  if (!record || now > record.resetAt) {
    hits.set(key, { count: 1, resetAt: now + windowMs });
    if (hits.size > 10000) {
      const cutoff = now - 60000;
      for (const [k, v] of hits) {
        if (v.resetAt < cutoff) hits.delete(k);
      }
    }
    return { allowed: true, remaining: maxRequests - 1, resetIn: windowMs };
  }

  record.count++;
  if (record.count > maxRequests) {
    return { allowed: false, remaining: 0, resetIn: record.resetAt - now };
  }

  return { allowed: true, remaining: maxRequests - record.count, resetIn: record.resetAt - now };
}
