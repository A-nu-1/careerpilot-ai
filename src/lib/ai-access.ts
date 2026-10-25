import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";

export const OWNER_COOKIE = "careerpilot_owner_session";
const MAX_AGE = 60 * 60 * 24 * 7;
function secret() {
  return process.env.CAREERPILOT_SESSION_SECRET || "";
}
function sign(text: string) {
  return createHmac("sha256", secret()).update(text).digest("hex");
}
export function issueOwnerToken() {
  const payload = `${Date.now() + MAX_AGE * 1000}.${randomBytes(16).toString("hex")}`;
  return `${payload}.${sign(payload)}`;
}
export function isOwner(request: NextRequest) {
  if (!secret() || !process.env.CAREERPILOT_OWNER_PASSWORD) return false;
  const token = request.cookies.get(OWNER_COOKIE)?.value || "";
  const match = /^(\d+)\.([a-f0-9]{32})\.([a-f0-9]{64})$/.exec(token);
  if (!match || Number(match[1]) <= Date.now()) return false;
  const expected = Buffer.from(sign(`${match[1]}.${match[2]}`), "hex");
  const provided = Buffer.from(match[3], "hex");
  return timingSafeEqual(expected, provided);
}
export function verifyPassword(input: string) {
  const correct = process.env.CAREERPILOT_OWNER_PASSWORD || "";
  if (!correct || !secret() || input.length > 256) return false;
  const a = createHmac("sha256", secret()).update(input).digest();
  const b = createHmac("sha256", secret()).update(correct).digest();
  return timingSafeEqual(a, b);
}
export function resolveAiKey(request: NextRequest): {
  key: string | null;
  mode: "owner" | "visitor" | "none";
} {
  if (isOwner(request))
    return { key: process.env.GEMINI_API_KEY || null, mode: "owner" };
  const visitorKey =
    request.headers.get("x-careerpilot-gemini-key")?.trim() || "";
  if (
    visitorKey.length >= 20 &&
    visitorKey.length <= 256 &&
    !/[\s\r\n]/.test(visitorKey)
  ) {
    return { key: visitorKey, mode: "visitor" };
  }
  return { key: null, mode: "none" };
}
export function rejectMissingKey() {
  return Response.json(
    {
      error:
        "Sign in as the owner or enter your own Gemini API key in AI Access.",
    },
    { status: 401, headers: { "Cache-Control": "no-store" } },
  );
}
export const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: MAX_AGE,
};
