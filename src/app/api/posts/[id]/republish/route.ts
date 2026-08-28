import { NextResponse } from "next/server";
import { getSupabaseAdmin, supabaseConfigured } from "@/lib/supabase";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { accessLevelOf, canPublish } from "@/lib/access";
import { publishPost } from "@/lib/publish";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Reenvia um post que falhou/não saiu. NÃO duplica: alvos que já têm ID
 *  externo (já publicados) são pulados; só os que faltaram são reenviados. */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!supabaseConfigured) {
    return NextResponse.json({ error: "Supabase não configurado" }, { status: 500 });
  }
  // Falha FECHADA: sem sessão legível, recusa (antes o catch deixava seguir).
  let podePublicar = false;
  try {
    const sbAuth = await createSupabaseServerClient();
    const {
      data: { user },
    } = await sbAuth.auth.getUser();
    podePublicar = canPublish(accessLevelOf(user));
  } catch {
    podePublicar = false;
  }
  if (!podePublicar) {
    return NextResponse.json({ error: "Seu nível de acesso não permite publicar." }, { status: 403 });
  }

  const { id } = await params;
  try {
    const sb = getSupabaseAdmin();
    // alvos sem ID externo voltam a "agendado"; os já publicados ficam como estão
    await sb
      .from("post_targets")
      .update({ status: "agendado", error_message: null })
      .eq("post_id", id)
      .is("external_post_id", null);
    // libera o post pra ser reprocessado
    await sb
      .from("scheduled_posts")
      .update({ status: "agendado", publish_lock: null })
      .eq("id", id);

    const result = await publishPost(id);
    return NextResponse.json({ ok: result.published > 0, ...result });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
