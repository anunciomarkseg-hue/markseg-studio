import { NextResponse } from "next/server";
import { getSupabaseAdmin, supabaseConfigured } from "@/lib/supabase";
import { getActiveGroup } from "@/lib/active";
import { getInstagramMedia, getFacebookPagePosts, type PublishedMedia } from "@/lib/meta";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

type Item = PublishedMedia & { account: string };

/**
 * Tudo que já foi publicado na conta do cliente ATIVO — venha de onde vier
 * (Estúdio, Meta Business ou app da rede). Remove o que o Estúdio já publicou
 * (pra não aparecer duplicado no calendário).
 */
export async function GET() {
  if (!supabaseConfigured) return NextResponse.json({ items: [] });
  const group = await getActiveGroup();
  if (!group) return NextResponse.json({ items: [], note: "Selecione um cliente pra ver o que foi publicado." });

  const sb = getSupabaseAdmin();
  const { data: accounts } = await sb
    .from("social_accounts")
    .select("id, platform, external_id, access_token, name, group_key");
  const clientAccounts = (accounts ?? []).filter((a) => (a.group_key || a.id) === group);
  if (!clientAccounts.length) return NextResponse.json({ items: [] });

  // ids externos que o Estúdio já publicou (dedupe)
  const accIds = clientAccounts.map((a) => a.id);
  const studioExt = new Set<string>();
  const { data: tg } = await sb
    .from("post_targets")
    .select("external_post_id")
    .in("account_id", accIds)
    .not("external_post_id", "is", null);
  for (const t of tg ?? []) if (t.external_post_id) studioExt.add(String(t.external_post_id));

  const items: Item[] = [];
  await Promise.all(
    clientAccounts.map(async (a) => {
      try {
        const media =
          a.platform === "instagram"
            ? await getInstagramMedia(a.external_id, a.access_token)
            : a.platform === "facebook"
              ? await getFacebookPagePosts(a.external_id, a.access_token)
              : [];
        for (const m of media) {
          const tail = m.id.includes("_") ? m.id.split("_").pop()! : m.id;
          if (studioExt.has(m.id) || studioExt.has(tail)) continue; // já é do Estúdio
          items.push({ ...m, account: a.name });
        }
      } catch {
        /* conta sem permissão/token — ignora, mostra o resto */
      }
    }),
  );

  items.sort((x, y) => +new Date(y.timestamp) - +new Date(x.timestamp));
  return NextResponse.json({ items });
}
