import { NextResponse } from "next/server";
import { exchangeLinkedInCode, getLinkedInOrganizations } from "@/lib/linkedin";
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
    // "sem_codigo" sozinho não diz nada. Lista as CHAVES que chegaram (nunca os
    // valores: code e state são credenciais) pra dar por onde começar.
    const chaves = [...url.searchParams.keys()];
    const detalhe = chaves.length
      ? `o LinkedIn respondeu sem "code" (veio: ${chaves.join(", ")})`
      : "o LinkedIn devolveu a página sem nenhum parâmetro — confira a Redirect URL autorizada no app e se o produto Community Management API está aprovado";
    return back(`?erro=${encodeURIComponent(detalhe)}`);
  }

  const cookieState = req.headers.get("cookie")?.match(/linkedin_oauth_state=([^;]+)/)?.[1];
  if (!state || !cookieState || state !== cookieState) {
    return back("?erro=state_invalido");
  }

  try {
    const redirectUri = `${origin}/api/linkedin/callback`;
    const token = await exchangeLinkedInCode(code, redirectUri);
    const orgs = await getLinkedInOrganizations(token);

    let count = 0;
    for (const o of orgs) {
      await upsertAccount({
        platform: "linkedin",
        external_id: o.id,
        name: o.name,
        handle: o.name,
        followers: 0,
        avatar: "gradient-blue",
        access_token: token,
        group_key: `li-${o.id}`,
      });
      count++;
    }

    const res = back(`?conectado=${count}`);
    res.cookies.delete("linkedin_oauth_state");
    return res;
  } catch (e) {
    return back(`?erro=${encodeURIComponent((e as Error).message)}`);
  }
}
