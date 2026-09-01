import { NextResponse } from "next/server";
import { getSupabaseAdmin, supabaseConfigured } from "@/lib/supabase";
import { deleteFacebookPost } from "@/lib/meta";
import { deleteLinkedInPost } from "@/lib/linkedin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { accessLevelOf, canPublish } from "@/lib/access";

export const dynamic = "force-dynamic";

const PLATFORM_LABEL: Record<string, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  linkedin: "LinkedIn",
  tiktok: "TikTok",
};

/**
 * Exclui a publicação.
 * - Alvos já publicados: tenta apagar NA REDE (Facebook e LinkedIn permitem via API;
 *   Instagram e TikTok NÃO — nesses a exclusão precisa ser feita no app).
 * - Depois remove o registro do nosso banco.
 */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!supabaseConfigured) {
    return NextResponse.json({ error: "Supabase não configurado" }, { status: 500 });
  }

  // Ação destrutiva: apaga o post do cliente NA REDE SOCIAL. Exige nível que
  // pode publicar (admin/editor). Sem esta checagem, qualquer pessoa logada —
  // inclusive nível "viewer" — conseguia apagar publicações de clientes.
  // Falha fechada de propósito: sem sessão legível, recusa.
  let nivelOk = false;
  try {
    const sbAuth = await createSupabaseServerClient();
    const {
      data: { user },
    } = await sbAuth.auth.getUser();
    nivelOk = canPublish(accessLevelOf(user));
  } catch {
    nivelOk = false;
  }
  if (!nivelOk) {
    return NextResponse.json(
      { error: "Seu nível de acesso não permite excluir publicações." },
      { status: 403 },
    );
  }

  const { id } = await params;
  const sb = getSupabaseAdmin();

  const { data: targets } = await sb
    .from("post_targets")
    .select("account_id, status, external_post_id")
    .eq("post_id", id);

  const published = (targets ?? []).filter((t) => t.status === "publicado" && t.external_post_id);
  let removedRemote = 0;
  const manual: string[] = []; // redes onde a API não deixa apagar
  const failures: string[] = [];

  if (published.length) {
    const { data: accounts } = await sb
      .from("social_accounts")
      .select("id, platform, access_token")
      .in("id", published.map((t) => t.account_id));
    const accById = new Map((accounts ?? []).map((a) => [a.id, a]));

    for (const t of published) {
      const acc = accById.get(t.account_id);
      if (!acc) continue;
      try {
        if (acc.platform === "facebook") {
          await deleteFacebookPost(t.external_post_id as string, acc.access_token);
          removedRemote++;
        } else if (acc.platform === "linkedin") {
          await deleteLinkedInPost(t.external_post_id as string, acc.access_token);
          removedRemote++;
        } else {
          // Instagram e TikTok não têm exclusão via API — precisa apagar no app.
          const label = PLATFORM_LABEL[acc.platform] ?? acc.platform;
          if (!manual.includes(label)) manual.push(label);
        }
      } catch (e) {
        failures.push(`${PLATFORM_LABEL[acc.platform] ?? acc.platform}: ${(e as Error).message}`);
      }
    }
  }

  // Se falhou apagar em alguma rede, mantém o registro pra dar pra tentar de novo.
  if (failures.length) {
    return NextResponse.json(
      { error: `Não apaguei tudo na rede (registro mantido pra nova tentativa) — ${failures.join("; ")}` },
      { status: 502 },
    );
  }

  const { error } = await sb.from("scheduled_posts").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, removedRemote, manual, failures });
}

/**
 * Reagenda a publicação: muda a data/hora do agendamento ANTES de ela sair.
 *
 * Regras:
 * - Só quem pode publicar (admin/editor) reagenda. Falha FECHADA.
 * - Post já publicado NÃO se reagenda (a data virou histórico).
 * - Se a trava de publicação está fresca, alguém já está mandando o post
 *   agora — recusa, pra não mexer na data no meio do envio.
 * - A nova data precisa ser no futuro (reagendar pro passado faria o cron
 *   disparar na próxima rodada, o que ninguém espera de um "reagendar").
 * - Post que falhou volta pra "agendado" (e os destinos que não saíram são
 *   limpos), senão o cron nunca tentaria de novo na data nova. Destinos com
 *   ID externo ficam como estão — não duplica o que já foi publicado.
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!supabaseConfigured) {
    return NextResponse.json({ error: "Supabase não configurado" }, { status: 500 });
  }

  let nivelOk = false;
  try {
    const sbAuth = await createSupabaseServerClient();
    const {
      data: { user },
    } = await sbAuth.auth.getUser();
    nivelOk = canPublish(accessLevelOf(user));
  } catch {
    nivelOk = false;
  }
  if (!nivelOk) {
    return NextResponse.json(
      { error: "Seu nível de acesso não permite reagendar publicações." },
      { status: 403 },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const scheduledFor = typeof body.scheduledFor === "string" ? body.scheduledFor : "";
  const quando = Date.parse(scheduledFor);
  if (!scheduledFor || Number.isNaN(quando)) {
    return NextResponse.json({ error: "Data/hora inválida" }, { status: 400 });
  }
  // 1 minuto de folga pro relógio do navegador não brigar com o do servidor
  if (quando < Date.now() - 60_000) {
    return NextResponse.json(
      { error: "A nova data precisa ser no futuro. Pra publicar agora, use 'Publicar agora'." },
      { status: 400 },
    );
  }

  const { id } = await params;
  const sb = getSupabaseAdmin();

  const { data: post, error: readErr } = await sb
    .from("scheduled_posts")
    .select("id, status, publish_lock, scheduled_for")
    .eq("id", id)
    .maybeSingle();
  if (readErr) {
    return NextResponse.json({ error: readErr.message }, { status: 500 });
  }
  if (!post) {
    return NextResponse.json({ error: "Publicação não encontrada" }, { status: 404 });
  }
  if (post.status === "publicado") {
    return NextResponse.json(
      { error: "Este post já foi publicado — não dá pra mudar a data." },
      { status: 409 },
    );
  }
  const lock = post.publish_lock ? Date.parse(post.publish_lock) : NaN;
  if (!Number.isNaN(lock) && Date.now() - lock < 5 * 60 * 1000) {
    return NextResponse.json(
      { error: "Este post está sendo publicado agora. Aguarde e tente de novo." },
      { status: 409 },
    );
  }

  const voltaPraFila = post.status === "falhou";
  const { data: alterados, error } = await sb
    .from("scheduled_posts")
    .update({
      scheduled_for: new Date(quando).toISOString(),
      ...(voltaPraFila ? { status: "agendado", publish_lock: null } : {}),
    })
    .eq("id", id)
    .neq("status", "publicado") // corrida: se publicou nesse meio-tempo, não mexe
    .select("id");
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!alterados || alterados.length === 0) {
    return NextResponse.json(
      { error: "O post saiu enquanto você mudava a data — a data não foi alterada." },
      { status: 409 },
    );
  }

  if (voltaPraFila) {
    // só os destinos que NÃO saíram voltam pra fila (os publicados não duplicam)
    await sb
      .from("post_targets")
      .update({ status: "agendado", error_message: null })
      .eq("post_id", id)
      .is("external_post_id", null);
  }

  return NextResponse.json({
    ok: true,
    id,
    scheduledFor: new Date(quando).toISOString(),
    status: voltaPraFila ? "agendado" : post.status,
    requeued: voltaPraFila,
  });
}
