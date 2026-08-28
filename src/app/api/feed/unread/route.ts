import { NextResponse } from "next/server";
import { getSupabaseAdmin, supabaseConfigured } from "@/lib/supabase";

export const dynamic = "force-dynamic";

/**
 * Só a CONTAGEM de mensagens não lidas das Conversas.
 *
 * O contador fica no topo de TODAS as telas e se atualiza a cada 25s. Antes ele
 * chamava /api/feed, que carrega 100 posts + todos os comentários + todas as
 * reações — trabalho enorme, repetido o dia inteiro, só pra mostrar um número.
 * Aqui a contagem é feita no banco e volta só o número.
 *
 * Parâmetros: ?since=<ms desde 1970>&me=<nome de quem está olhando>
 */
export async function GET(req: Request) {
  if (!supabaseConfigured) return NextResponse.json({ unread: 0 });
  const url = new URL(req.url);
  const sinceMs = Number(url.searchParams.get("since") ?? "0");
  const me = (url.searchParams.get("me") ?? "").trim();
  const sinceIso = new Date(Number.isFinite(sinceMs) ? sinceMs : 0).toISOString();

  try {
    const sb = getSupabaseAdmin();
    const posts = sb
      .from("feed_posts")
      .select("id", { count: "exact", head: true })
      .gt("created_at", sinceIso);
    const comments = sb
      .from("feed_comments")
      .select("id", { count: "exact", head: true })
      .gt("created_at", sinceIso);
    // não conta o que a própria pessoa escreveu
    if (me) {
      posts.neq("author_name", me);
      comments.neq("author_name", me);
    }
    const [p, c] = await Promise.all([posts, comments]);
    return NextResponse.json({ unread: (p.count ?? 0) + (c.count ?? 0) });
  } catch {
    return NextResponse.json({ unread: 0 });
  }
}
