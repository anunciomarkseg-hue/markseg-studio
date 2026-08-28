import { NextResponse } from "next/server";
import { getSupabaseAdmin, supabaseConfigured } from "@/lib/supabase";

export const dynamic = "force-dynamic";

/**
 * Estado REAL de um post (e de cada conta de destino).
 *
 * Serve pra parar de "adivinhar" o resultado pela resposta HTTP: quando a
 * função de publicar é cortada por tempo (Reel/vídeo), a publicação em geral
 * CONTINUA e dá certo — o app só não recebeu a resposta. Aqui ele consulta o
 * que de fato aconteceu, em vez de assustar o usuário com erro falso.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!supabaseConfigured) {
    return NextResponse.json({ error: "Supabase não configurado" }, { status: 500 });
  }
  const { id } = await params;
  try {
    const sb = getSupabaseAdmin();
    const { data: post } = await sb
      .from("scheduled_posts")
      .select("id, status, published_at")
      .eq("id", id)
      .maybeSingle();
    if (!post) return NextResponse.json({ error: "Post não encontrado" }, { status: 404 });

    const { data: targets } = await sb
      .from("post_targets")
      .select("account_id, status, external_post_id, error_message")
      .eq("post_id", id);

    const rows = targets ?? [];
    const publicados = rows.filter((t) => t.status === "publicado" || t.external_post_id).length;
    const falhas = rows.filter((t) => t.status === "falhou");
    // sem id externo e sem erro = ainda em processamento (ex.: Reel no forno)
    const processando = rows.filter(
      (t) => t.status !== "publicado" && !t.external_post_id && !t.error_message,
    ).length;

    return NextResponse.json({
      id: post.id,
      status: post.status,
      publishedAt: post.published_at ?? null,
      total: rows.length,
      publicados,
      falhou: falhas.length,
      processando,
      primeiroErro: falhas.find((t) => t.error_message)?.error_message ?? null,
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
