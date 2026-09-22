const globalBuckets = globalThis as unknown as {
  __sbRate?: Map<string, number[]>;
};

function buckets() {
  if (!globalBuckets.__sbRate) globalBuckets.__sbRate = new Map();
  return globalBuckets.__sbRate;
}

export function clientIp(req: Request) {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "local";
  return req.headers.get("x-real-ip") || "local";
}

export function rateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const recent = (buckets().get(key) || []).filter((ts) => now - ts < windowMs);
  if (recent.length >= limit) {
    buckets().set(key, recent);
    return false;
  }
  recent.push(now);
  buckets().set(key, recent);
  return true;
}
