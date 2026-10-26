import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GeocodeResult } from "@/lib/types";

const geocode = vi.fn<(query: string) => Promise<GeocodeResult[]>>();
const checkRateLimit = vi.fn<(request: Request) => Response | null>();

vi.mock("@/lib/routing", () => ({ geocode }));
vi.mock("@/lib/rateLimit", () => ({ checkRateLimit }));

describe("GET /api/geocode", () => {
  beforeEach(() => {
    vi.resetModules();
    geocode.mockReset();
    checkRateLimit.mockReset();
    checkRateLimit.mockReturnValue(null);
  });

  it("returns 400 for a query shorter than 2 characters", async () => {
    const { GET } = await import("../route");
    const response = await GET(new Request("http://localhost/api/geocode?q=a"));
    expect(response.status).toBe(400);
    expect(geocode).not.toHaveBeenCalled();
  });

  it("returns 400 when q is missing", async () => {
    const { GET } = await import("../route");
    const response = await GET(new Request("http://localhost/api/geocode"));
    expect(response.status).toBe(400);
  });

  it("returns geocode results for a valid query", async () => {
    geocode.mockResolvedValue([{ label: "Mannerheimintie 5, Helsinki, Finland", lat: 60.17, lon: 24.94 }]);
    const { GET } = await import("../route");

    const response = await GET(new Request("http://localhost/api/geocode?q=Mannerheimintie"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.results).toHaveLength(1);
    expect(geocode).toHaveBeenCalledWith("Mannerheimintie");
  });

  it("returns 502 when the upstream geocoder fails", async () => {
    geocode.mockRejectedValue(new Error("all providers down"));
    const { GET } = await import("../route");

    const response = await GET(new Request("http://localhost/api/geocode?q=Mannerheimintie"));
    expect(response.status).toBe(502);
  });

  it("returns 429 when rate limited, without calling the geocoder", async () => {
    checkRateLimit.mockReturnValue(new Response(null, { status: 429 }));
    const { GET } = await import("../route");

    const response = await GET(new Request("http://localhost/api/geocode?q=Mannerheimintie"));
    expect(response.status).toBe(429);
    expect(geocode).not.toHaveBeenCalled();
  });
});
