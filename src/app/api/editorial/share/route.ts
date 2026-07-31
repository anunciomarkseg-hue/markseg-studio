import { NextResponse } from "next/server";
import { createEditorialShare } from "@/lib/editorial";
import { getSupabaseAdmin, supabaseConfigured } from "@/lib/supabase";

export const dynamic = "force-dynamic";

/**
 * Gera (ou reaproveita) o link de aprovação do cliente E envia a pauta:
 * marca os posts em "rascunho" como "enviado" pra aparecerem pro cliente.
 */
export async function POST(req: Request) {
  if (!supabaseConfigured) {
    return NextResponse.json({ error: "Supabase não configurado" }, { status: 500 });
  }
  const body = (await req.json().catch(() => ({}))) as { group_key?: string };
  if (!body.group_key) {
    return NextResponse.json({ error: "Selecione um cliente antes de compartilhar" }, { status: 400 });
  }
  try {
    const token = await createEditorialShare(body.group_key);

    // envia pra aprovação: rascunho -> enviado
    const { data: sent } = await getSupabaseAdmin()
      .from("editorial_posts")
      .update({ approval_status: "enviado", updated_at: new Date().toISOString() })
      .eq("group_key", body.group_key)
      .eq("approval_status", "rascunho")
      .select("id");

    return NextResponse.json({ ok: true, token, sent: sent?.length ?? 0 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
