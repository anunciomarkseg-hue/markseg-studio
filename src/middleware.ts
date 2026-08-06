import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { accessLevelOf, canPublish } from "@/lib/access";
import { canUseVault } from "@/lib/vault";

/** Renova a sessão e protege as rotas: sem login -> manda pro /login. */
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isPublic =
    path.startsWith("/login") ||
    path.startsWith("/auth") ||
    path.startsWith("/definir-senha") ||
    path.startsWith("/opengraph-image") || // imagem de preview (WhatsApp/redes)
    path.startsWith("/r/") || // relatório público do cliente
    path.startsWith("/cal/") || // calendário editorial público do cliente (sem login)
    path.startsWith("/aprovar") || // aprovação pública da pauta (cliente sem login)
    path.startsWith("/api/aprovar") || // API da aprovação pública
    path.startsWith("/mural") || // mural de recados (público, sem login)
    path.startsWith("/api/mural") || // GET/urgent públicos; POST e [id] checam login no handler
    path.startsWith("/conversas") || // rede social do time (público, cadastro rápido)
    path.startsWith("/api/feed") || // feed: GET/POST/comment/react públicos; DELETE checa login no handler
    path.startsWith("/api/push") || // inscrição de avisos (push) — público
    path.startsWith("/api/version") || // marca de versão p/ auto-update do app instalado
    path.startsWith("/termos") || // termos de uso (público p/ review das APIs)
    path.startsWith("/privacidade") || // política de privacidade (idem)
    path.startsWith("/api/cron"); // cron tem auth própria (CRON_SECRET)

  if (!user && !isPublic) {
    // Chamadas de API (fetch) recebem 401 JSON — nunca a tela de login em HTML
    // (senão o fetch quebra com "not valid JSON" e o erro fica confuso).
    if (path.startsWith("/api/")) {
      return NextResponse.json({ error: "Sessão expirada — atualize a página e entre de novo." }, { status: 401 });
    }
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
  if (user && path === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  // ── Controle por NÍVEL de acesso (páginas) ────────────────────────────────
  if (user) {
    const level = accessLevelOf(user);
    const needsPublish = path.startsWith("/publicar");
    const needsAdmin = path.startsWith("/contas") || path.startsWith("/equipe");
    const needsVault = path.startsWith("/cofre"); // cofre: só admin (canUseVault)
    if (
      (needsPublish && !canPublish(level)) ||
      (needsAdmin && level !== "admin") ||
      (needsVault && !canUseVault(level))
    ) {
      const url = request.nextUrl.clone();
      url.pathname = "/";
      url.search = "";
      return NextResponse.redirect(url);
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|brand/|sw.js|manifest.webmanifest|.*\\.(?:png|jpg|jpeg|svg|ico|webp|txt|bat)$).*)",
  ],
};
