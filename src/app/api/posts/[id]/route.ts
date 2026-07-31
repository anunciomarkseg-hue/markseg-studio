import { NextResponse } from "next/server";
import { getSupabaseAdmin, supabaseConfigured } from "@/lib/supabase";
import { deleteFacebookPost } from "@/lib/meta";
import { deleteLinkedInPost } from "@/lib/linkedin";

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
