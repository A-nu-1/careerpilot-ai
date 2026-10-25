import { NextResponse } from "next/server";
import { OWNER_COOKIE } from "@/lib/ai-access";
export async function POST() {
  const res = NextResponse.json(
    { authenticated: false },
    { headers: { "Cache-Control": "no-store" } },
  );
  res.cookies.set(OWNER_COOKIE, "", {
    path: "/",
    maxAge: 0,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
  });
  return res;
}
