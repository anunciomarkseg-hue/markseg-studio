import { NextResponse } from "next/server";
import { getSupabaseAdmin, supabaseConfigured } from "@/lib/supabase";
import { getEditorialShare, addFeedback } from "@/lib/editorial";

export const dynamic = "force-dynamic";

/**
 * Aprovação/ajuste PÚBLICO (cliente sem login). O `token` autoriza a ação só
 * nos posts do cliente daquele link. Cada ação cria um FEEDBACK (acumula — se
 * várias pessoas pedirem ajuste, todos ficam registrados).
 */
export async function POST(req: Request) {
  if (!supabaseConfigured) {
    return NextResponse.json({ error: "Supabase não configurado" }, { status: 500 });
  }
  const body = (await req.json().catch(() => ({}))) as {
    token?: string;
    postId?: string;
    action?: "aprovado" | "ajustes";
    feedback?: string;
    author?: string;
  };

  if (!body.token || !body.postId || !["aprovado", "ajustes"].includes(body.action ?? "")) {
    return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  }

  const share = await getEditorialShare(body.token);
  if (!share) return NextResponse.json({ error: "Link inválido" }, { status: 404 });

  const sb = getSupabaseAdmin();
  const { data: post } = await sb
    .from("editorial_posts")
    .select("id, group_key")
    .eq("id", body.postId)
    .maybeSingle();
  if (!post || post.group_key !== share.group_key) {
    return NextResponse.json({ error: "Post não pertence a este link" }, { status: 403 });
  }

  const action = body.action as "aprovado" | "ajustes";
  const author = body.author?.trim() || null;

  // registra o feedback (acumula) — ajuste sempre; aprovação só se veio comentário
  if (action === "ajustes" || body.feedback?.trim()) {
    await addFeedback(post.id, author, body.feedback?.trim() || "", action);
  }

  // status do post: ajuste "ganha" (precisa de trabalho) mesmo se alguém já aprovou
  const { error } = await sb
    .from("editorial_posts")
    .update({ approval_status: action, updated_at: new Date().toISOString() })
    .eq("id", body.postId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
