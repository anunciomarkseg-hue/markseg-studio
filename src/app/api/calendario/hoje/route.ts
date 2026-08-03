import { NextResponse } from "next/server";
import { supabaseConfigured, getSupabaseAdmin } from "@/lib/supabase";
import { listTodayPosts } from "@/lib/calendar";
import { isCurrentUserAdmin } from "@/lib/admins";

export const dynamic = "force-dynamic";

/**
 * Posts de HOJE nos calendários editoriais (todos os clientes).
 * Alimenta o alerta do Studio (popup). Resolve o nome do cliente pelo group_key.
 */
export async function GET() {
  if (!supabaseConfigured) return NextResponse.json({ today: [] });
  // Alerta só pra admins — quem não é admin recebe vazio (o popup nem aparece).
  if (!(await isCurrentUserAdmin())) return NextResponse.json({ today: [] });
  try {
    const posts = await listTodayPosts();
    if (!posts.length) return NextResponse.json({ today: [] });

    const groups = [...new Set(posts.map((p) => p.group_key))].filter(Boolean);
    const { data: accs } = await getSupabaseAdmin()
      .from("social_accounts")
      .select("group_key, name, platform")
      .in("group_key", groups.length ? groups : ["__none__"]);
    const nameOf = (g: string) => {
      const rows = (accs ?? []).filter((a) => a.group_key === g);
      return rows.find((a) => a.platform === "facebook")?.name || rows[0]?.name || "Cliente";
    };

    return NextResponse.json({
      today: posts.map((p) => ({
        id: p.id,
        planned_date: p.planned_date,
        format: p.format,
        title: p.title || "(sem título)",
        client: nameOf(p.group_key),
      })),
    });
  } catch {
    return NextResponse.json({ today: [] });
  }
}
