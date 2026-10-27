import { NextResponse } from "next/server";

const PRUNE_THRESHOLD = 10_000;

interface Bucket {
  count: number;
  windowStart: number;
}

function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return "unknown";
}

/**
 * Best-effort in-memory per-IP rate limiter for routes that call a paid,
 * rate-limited third-party API (OpenRouteService) with our shared key.
 * Serverless instances are ephemeral and don't share state across each
 * other, so this isn't a hard guarantee - it meaningfully raises the cost
 * of abuse within a warm instance, which is the realistic threat model here.
 *
 * Returns a function that gives back a 429 Response to return immediately,
 * or null to continue.
 */
function createLimiter(windowMs: number, maxRequests: number, message: string) {
  const buckets = new Map<string, Bucket>();

  function pruneStaleBuckets(now: number): void {
    if (buckets.size < PRUNE_THRESHOLD) return;
    for (const [ip, bucket] of buckets) {
      if (now - bucket.windowStart > windowMs) buckets.delete(ip);
    }
  }

  return function check(request: Request): Response | null {
    const now = Date.now();
    pruneStaleBuckets(now);

    const ip = clientIp(request);
    const bucket = buckets.get(ip);

    if (!bucket || now - bucket.windowStart > windowMs) {
      buckets.set(ip, { count: 1, windowStart: now });
      return null;
    }

    bucket.count += 1;
    if (bucket.count > maxRequests) {
      return NextResponse.json({ error: message }, { status: 429 });
    }

    return null;
  };
}

export const checkRateLimit = createLimiter(
  60_000,
  30,
  "Too many requests. Please slow down and try again shortly.",
);

// A coarser daily cap on top of the per-minute burst limiter above - catches
// an IP that stays just under the per-minute threshold but hammers the
// endpoint steadily over hours, which would otherwise run up usage against
// the routing providers' free-tier quota all day undetected.
export const checkDailyLimit = createLimiter(
  24 * 60 * 60 * 1000,
  20,
  "Daily request limit reached for this address. Please try again tomorrow.",
);
