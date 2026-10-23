import { NextResponse } from "next/server";

const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 30;
const PRUNE_THRESHOLD = 10_000;

interface Bucket {
  count: number;
  windowStart: number;
}

const buckets = new Map<string, Bucket>();

function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return "unknown";
}

function pruneStaleBuckets(now: number): void {
  if (buckets.size < PRUNE_THRESHOLD) return;
  for (const [ip, bucket] of buckets) {
    if (now - bucket.windowStart > WINDOW_MS) buckets.delete(ip);
  }
}

/**
 * Best-effort in-memory per-IP rate limiter for routes that call a paid,
 * rate-limited third-party API (OpenRouteService) with our shared key.
 * Serverless instances are ephemeral and don't share state across each
 * other, so this isn't a hard guarantee - it meaningfully raises the cost
 * of abuse within a warm instance, which is the realistic threat model here.
 *
 * Returns a 429 Response to return immediately, or null to continue.
 */
export function checkRateLimit(request: Request): Response | null {
  const now = Date.now();
  pruneStaleBuckets(now);

  const ip = clientIp(request);
  const bucket = buckets.get(ip);

  if (!bucket || now - bucket.windowStart > WINDOW_MS) {
    buckets.set(ip, { count: 1, windowStart: now });
    return null;
  }

  bucket.count += 1;
  if (bucket.count > MAX_REQUESTS_PER_WINDOW) {
    return NextResponse.json(
      { error: "Too many requests. Please slow down and try again shortly." },
      { status: 429 },
    );
  }

  return null;
}
