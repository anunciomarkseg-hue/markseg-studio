import { NextResponse } from "next/server";
import { exchangeTikTokCode, getTikTokCreator } from "@/lib/tiktok";
import { upsertAccount } from "@/lib/db";

export const dynamic = "force-dynamic";

function appOrigin(req: Request): string {
  const h = req.headers;
  const proto = h.get("x-forwarded-proto") ?? "http";
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  return `${proto}://${host}`;
}

export async function GET(req: Request) {
  const origin = appOrigin(req);
  const url = new URL(req.url);
  const back = (q: string) => NextResponse.redirect(`${origin}/contas${q}`);

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error_description") ?? url.searchParams.get("error");

  if (oauthError) return back(`?erro=${encodeURIComponent(oauthError)}`);
  if (!code) {
    // Só as CHAVES recebidas (code e state são credenciais, não vão pra URL).
    const chaves = [...url.searchParams.keys()];
    const detalhe = chaves.length
      ? `o TikTok respondeu sem "code" (veio: ${chaves.join(", ")})`
      : "o TikTok devolveu a página sem nenhum parâmetro — confira a Redirect URI autorizada no app";
    return back(`?erro=${encodeURIComponent(detalhe)}`);
  }

  const cookieState = req.headers.get("cookie")?.match(/tiktok_oauth_state=([^;]+)/)?.[1];
  if (!state || !cookieState || state !== cookieState) {
    return back("?erro=state_invalido");
  }

  try {
    const redirectUri = `${origin}/api/tiktok/callback`;
    const t = await exchangeTikTokCode(code, redirectUri);
    const creator = await getTikTokCreator(t.accessToken).catch(() => ({
      username: "",
      displayName: "TikTok",
    }));

    await upsertAccount({
      platform: "tiktok",
      external_id: t.openId,
      name: creator.displayName,
      handle: creator.username ? `@${creator.username}` : creator.displayName,
      followers: 0,
      avatar: "gradient-orange",
      access_token: t.accessToken,
      refresh_token: t.refreshToken,
      token_expires_at: new Date(Date.now() + t.expiresIn * 1000).toISOString(),
      group_key: `tt-${t.openId}`,
    });

    const res = back(`?conectado=1`);
    res.cookies.delete("tiktok_oauth_state");
    return res;
  } catch (e) {
    return back(`?erro=${encodeURIComponent((e as Error).message)}`);
  }
}
