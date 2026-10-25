import { NextRequest, NextResponse } from "next/server";
import { isOwner } from "@/lib/ai-access";
export const runtime = "nodejs";
export async function GET(request: NextRequest) {
  return NextResponse.json(
    { authenticated: isOwner(request) },
    { headers: { "Cache-Control": "no-store" } },
  );
}
