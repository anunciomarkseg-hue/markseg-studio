import { NextResponse } from "next/server";
import { getTikTokLoginUrl, tiktokConfigured } from "@/lib/tiktok";

export const dynamic = "force-dynamic";

function appOrigin(req: Request): string {
  const h = req.headers;
  const proto = h.get("x-forwarded-proto") ?? "http";
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  return `${proto}://${host}`;
}

export async function GET(req: Request) {
  if (!tiktokConfigured) {
    return NextResponse.json(
      { error: "TikTok não configurado: defina TIKTOK_CLIENT_KEY e TIKTOK_CLIENT_SECRET no .env.local" },
      { status: 500 },
    );
  }
  const origin = appOrigin(req);
  const redirectUri = `${origin}/api/tiktok/callback`;
  const state = crypto.randomUUID();

  const res = NextResponse.redirect(getTikTokLoginUrl(redirectUri, state));
  res.cookies.set("tiktok_oauth_state", state, {
    httpOnly: true,
    secure: origin.startsWith("https"),
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });
  return res;
}
