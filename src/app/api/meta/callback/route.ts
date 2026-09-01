import { NextResponse } from "next/server";
import { exchangeCodeForToken, getLongLivedToken, getPages } from "@/lib/meta";
import { upsertAccount } from "@/lib/db";
import { getSupabaseAdmin } from "@/lib/supabase";

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
  if (!code) {
    // Só as CHAVES recebidas (code e state são credenciais, não vão pra URL).
    const chaves = [...url.searchParams.keys()];
    const detalhe = chaves.length
      ? `a Meta respondeu sem "code" (veio: ${chaves.join(", ")})`
      : "a Meta devolveu a página sem nenhum parâmetro — confira a URL de redirecionamento autorizada no app";
    return back(`?erro=${encodeURIComponent(detalhe)}`);
  }

  // valida o state (CSRF)
  const cookieState = req.headers.get("cookie")?.match(/meta_oauth_state=([^;]+)/)?.[1];
  if (!state || !cookieState || state !== cookieState) {
    return back("?erro=state_invalido");
  }

  try {
    const redirectUri = `${origin}/api/meta/callback`;
    const shortToken = await exchangeCodeForToken(code, redirectUri);
    const longToken = await getLongLivedToken(shortToken);
    const { pages, semToken, truncado } = await getPages(longToken);

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

    // ── DIAGNÓSTICO DA RECONEXÃO ──────────────────────────────────────────────
    // Antes esta rota devolvia só a CONTAGEM de sucessos. Quando uma Página não
    // vinha na enumeração (prazo estourado, Página sem token, ou o usuário não
    // administra mais), a conta ficava com o token velho e a tela dizia
    // "N conta(s) conectada(s)" como se tudo tivesse ido bem — foi assim que
    // clientes ficaram meses sem reconectar sem ninguém perceber.
    // Agora comparamos com o que JÁ está cadastrado e dizemos quem ficou de fora.
    const salvos = new Set<string>();
    for (const pg of pages) {
      salvos.add(pg.id);
      if (pg.instagram) salvos.add(pg.instagram.id);
    }
    // Tudo que a Meta MOSTROU, tendo dado token ou não. É o que separa
    // "a conta nem apareceu na sua lista" de "apareceu mas sem permissão" —
    // dois problemas com soluções completamente diferentes, que antes o aviso
    // juntava num monte só.
    const vistos = new Set<string>(salvos);
    for (const pg of semToken) {
      vistos.add(pg.id);
      if (pg.instagramId) vistos.add(pg.instagramId);
    }

    const semPermissao: string[] = [];
    const naoApareceram: string[] = [];
    try {
      const { data: existentes } = await getSupabaseAdmin()
        .from("social_accounts")
        .select("handle, name, external_id, platform")
        .in("platform", ["facebook", "instagram"]);
      for (const a of existentes ?? []) {
        if (a.external_id && salvos.has(a.external_id)) continue; // veio, tudo certo
        const nome = a.handle || a.name;
        if (!nome) continue;
        if (a.external_id && vistos.has(a.external_id)) semPermissao.push(nome);
        else naoApareceram.push(nome);
      }
    } catch {
      /* diagnóstico é extra: nunca derruba a reconexão */
    }

    const q = new URLSearchParams({ conectado: String(count) });
    // Quantas Páginas a Meta mostrou no total: é o número que diz se o login
    // usado enxerga o parque inteiro ou só um pedaço dele.
    q.set("vistas", String(pages.length + semToken.length));
    if (naoApareceram.length) {
      const mostra = naoApareceram.slice(0, 25);
      q.set("naoapareceram", mostra.join(", "));
      if (naoApareceram.length > mostra.length) {
        q.set("maisnaoapareceram", String(naoApareceram.length - mostra.length));
      }
    }
    if (semPermissao.length) {
      const mostra = semPermissao.slice(0, 25);
      q.set("sempermissao", mostra.join(", "));
      if (semPermissao.length > mostra.length) {
        q.set("maissempermissao", String(semPermissao.length - mostra.length));
      }
    }
    if (truncado) q.set("truncado", "1");

    const res = back(`?${q.toString()}`);
    res.cookies.delete("meta_oauth_state");
    return res;
  } catch (e) {
    return back(`?erro=${encodeURIComponent((e as Error).message)}`);
  }
}
