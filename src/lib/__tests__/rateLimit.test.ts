import { beforeEach, describe, expect, it, vi } from "vitest";
import { checkRateLimit } from "../rateLimit";

function requestFrom(ip: string): Request {
  return new Request("http://localhost/api/geocode?q=test", {
    headers: { "x-forwarded-for": ip },
  });
}

describe("checkRateLimit", () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it("allows requests under the limit", () => {
    const ip = `test-ip-${Math.random()}`;
    for (let i = 0; i < 10; i++) {
      expect(checkRateLimit(requestFrom(ip))).toBeNull();
    }
  });

  it("blocks requests once a single IP exceeds the window limit", () => {
    const ip = `test-ip-${Math.random()}`;
    let blocked: Response | null = null;

    for (let i = 0; i < 40; i++) {
      blocked = checkRateLimit(requestFrom(ip));
      if (blocked) break;
    }

    expect(blocked).not.toBeNull();
    expect(blocked?.status).toBe(429);
  });

  it("tracks separate IPs independently", () => {
    const ipA = `test-ip-a-${Math.random()}`;
    const ipB = `test-ip-b-${Math.random()}`;

    for (let i = 0; i < 30; i++) {
      checkRateLimit(requestFrom(ipA));
    }

    // ipB should still be fresh even though ipA is exhausted.
    expect(checkRateLimit(requestFrom(ipB))).toBeNull();
  });
});
