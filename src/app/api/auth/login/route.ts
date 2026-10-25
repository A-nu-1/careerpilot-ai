import { NextRequest, NextResponse } from "next/server";
import {
  OWNER_COOKIE,
  cookieOptions,
  issueOwnerToken,
  verifyPassword,
} from "@/lib/ai-access";
export const runtime = "nodejs";
export async function POST(request: NextRequest) {
  if (Number(request.headers.get("content-length") || 0) > 2048)
    return NextResponse.json({ error: "Invalid request" }, { status: 413 });
  const body: unknown = await request.json().catch(() => null);
  const password =
    body && typeof body === "object" && "password" in body
      ? (body as { password: unknown }).password
      : null;
  if (typeof password !== "string" || !verifyPassword(password))
    return NextResponse.json(
      { error: "Invalid password or owner access not configured." },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  const res = NextResponse.json(
    { authenticated: true },
    { headers: { "Cache-Control": "no-store" } },
  );
  res.cookies.set(OWNER_COOKIE, issueOwnerToken(), cookieOptions);
  return res;
}
