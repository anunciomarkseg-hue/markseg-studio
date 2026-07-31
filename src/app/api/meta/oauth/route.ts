import { NextResponse } from "next/server";
import { getLoginUrl, metaConfigured } from "@/lib/meta";

export const dynamic = "force-dynamic";

function appOrigin(req: Request): string {
  const h = req.headers;
  const proto = h.get("x-forwarded-proto") ?? "http";
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  return `${proto}://${host}`;
}

/** Inicia o login da Meta: redireciona para o diálogo OAuth do Facebook. */
export async function GET(req: Request) {
  if (!metaConfigured) {
    return NextResponse.json(
      { error: "Meta não configurada: defina META_APP_ID e META_APP_SECRET no .env.local" },
      { status: 500 },
    );
  }

  const origin = appOrigin(req);
  const redirectUri = `${origin}/api/meta/callback`;
  const state = crypto.randomUUID();

  const res = NextResponse.redirect(getLoginUrl(redirectUri, state));
  res.cookies.set("meta_oauth_state", state, {
    httpOnly: true,
    secure: origin.startsWith("https"),
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });
  return res;
}
