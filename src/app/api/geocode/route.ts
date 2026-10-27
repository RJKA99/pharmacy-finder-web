import { NextResponse } from "next/server";
import { geocode } from "@/lib/routing";
import { checkDailyLimit, checkRateLimit } from "@/lib/rateLimit";

// Query text varies per request; never cache this behind a static-looking GET.
export const dynamic = "force-dynamic";

const MIN_QUERY_LENGTH = 2;
const MAX_QUERY_LENGTH = 100;

export async function GET(request: Request): Promise<Response> {
  const rateLimited = checkRateLimit(request);
  if (rateLimited) return rateLimited;
  const dailyLimited = checkDailyLimit(request);
  if (dailyLimited) return dailyLimited;

  const { searchParams } = new URL(request.url);
  const query = (searchParams.get("q") ?? "").trim();

  if (query.length < MIN_QUERY_LENGTH || query.length > MAX_QUERY_LENGTH) {
    return NextResponse.json(
      { error: `q must be between ${MIN_QUERY_LENGTH} and ${MAX_QUERY_LENGTH} characters` },
      { status: 400 },
    );
  }

  try {
    const results = await geocode(query);
    return NextResponse.json({ results });
  } catch (error) {
    console.error("geocode failed", error);
    return NextResponse.json(
      { error: "Address search failed right now. Please try again shortly." },
      { status: 502 },
    );
  }
}
