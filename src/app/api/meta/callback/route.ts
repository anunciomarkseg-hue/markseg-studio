import { NextResponse } from "next/server";
import { exchangeCodeForToken, getLongLivedToken, getPages } from "@/lib/meta";
import { upsertAccount } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

function appOrigin(req: Request): string {
  const h = req.headers;
  const proto = h.get("x-forwarded-proto") ?? "http";
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  return `${proto}://${host}`;
}

/** Retorno do login da Meta: troca o código por token, busca Páginas + IG e salva no banco. */
export async function GET(req: Request) {
  const origin = appOrigin(req);
  const url = new URL(req.url);
  const back = (q: string) => NextResponse.redirect(`${origin}/contas${q}`);

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error_description") ?? url.searchParams.get("error");

  if (oauthError) return back(`?erro=${encodeURIComponent(oauthError)}`);
  if (!code) return back("?erro=sem_codigo");

  // valida o state (CSRF)
  const cookieState = req.headers.get("cookie")?.match(/meta_oauth_state=([^;]+)/)?.[1];
  if (!state || !cookieState || state !== cookieState) {
    return back("?erro=state_invalido");
  }

  try {
    const redirectUri = `${origin}/api/meta/callback`;
    const shortToken = await exchangeCodeForToken(code, redirectUri);
    const longToken = await getLongLivedToken(shortToken);
    const pages = await getPages(longToken);

    // Salva tudo em PARALELO (evita estourar o tempo com muitas Páginas).
    const tasks: Promise<void>[] = [];
    for (const pg of pages) {
      const groupKey = pg.id; // liga o IG e o FB do mesmo cliente
      tasks.push(
        upsertAccount({
          platform: "facebook",
          external_id: pg.id,
          name: pg.name,
          handle: pg.name,
          followers: 0,
          avatar: "gradient-blue",
          access_token: pg.access_token,
          group_key: groupKey,
        }),
      );
      if (pg.instagram) {
        tasks.push(
          upsertAccount({
            platform: "instagram",
            external_id: pg.instagram.id,
            name: pg.instagram.username,
            handle: `@${pg.instagram.username}`,
            followers: pg.instagram.followers,
            avatar: "gradient-orange",
            access_token: pg.access_token,
            group_key: groupKey,
          }),
        );
      }
    }
    const results = await Promise.allSettled(tasks);
    const count = results.filter((r) => r.status === "fulfilled").length;

    const res = back(`?conectado=${count}`);
    res.cookies.delete("meta_oauth_state");
    return res;
  } catch (e) {
    return back(`?erro=${encodeURIComponent((e as Error).message)}`);
  }
}
