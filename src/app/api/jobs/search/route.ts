import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const JOBS_API = "https://remotli.ch/api/jobs";

export async function GET(request: NextRequest) {
  try {
    const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";

    const type = request.nextUrl.searchParams.get("type") ?? "";

    const page = Number(request.nextUrl.searchParams.get("page") ?? "1");

    if (query.length > 100) {
      return NextResponse.json(
        { error: "Search query is too long." },
        { status: 400 },
      );
    }

    if (
      type &&
      !["part-time", "full-time", "contract", "freelance"].includes(type)
    ) {
      return NextResponse.json(
        { error: "Invalid employment type." },
        { status: 400 },
      );
    }

    if (!Number.isInteger(page) || page < 1 || page > 20) {
      return NextResponse.json({ error: "Invalid page." }, { status: 400 });
    }

    const url = new URL(JOBS_API);

    // Include remote, hybrid and office-based listings.
    url.searchParams.set("remote", "all");
    url.searchParams.set("limit", "20");
    url.searchParams.set("page", String(page));

    if (query) {
      url.searchParams.set("q", query);
    }

    if (type) {
      url.searchParams.set("type", type);
    }

    const response = await fetch(url.toString(), {
      headers: {
        Accept: "application/json",
      },

      // Cache requests to avoid repeatedly hitting the source.
      next: {
        revalidate: 300,
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        {
          error: `Job provider returned HTTP ${response.status}.`,
        },
        { status: 502 },
      );
    }

    const data: unknown = await response.json();

    if (
      !data ||
      typeof data !== "object" ||
      !("jobs" in data) ||
      !Array.isArray(data.jobs)
    ) {
      return NextResponse.json(
        { error: "Unexpected job provider response." },
        { status: 502 },
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error(
      "Real job search failed:",
      error instanceof Error ? error.message : "Unknown error",
    );

    return NextResponse.json(
      { error: "Unable to retrieve real jobs." },
      { status: 502 },
    );
  }
}
