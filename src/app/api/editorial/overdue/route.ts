import { NextResponse } from "next/server";
import { listPendingScheduling } from "@/lib/editorial";
import { getSupabaseAdmin, supabaseConfigured } from "@/lib/supabase";
import { isCurrentUserAdmin } from "@/lib/admins";

export const dynamic = "force-dynamic";

/**
 * Posts ATRASADOS: aprovados, ainda não agendados e com a data planejada já
 * vencida. Usado pelo popup de alerta. Resolve o nome do cliente pelo group_key.
 */
export async function GET() {
  if (!supabaseConfigured) return NextResponse.json({ overdue: [] });
  // Alerta só pra admins — quem não é admin recebe vazio (o popup nem aparece).
  if (!(await isCurrentUserAdmin())) return NextResponse.json({ overdue: [] });
  try {
    const now = Date.now();
    const pending = await listPendingScheduling();
    const overdue = pending.filter((p) => new Date(p.planned_date).getTime() < now);
    if (overdue.length === 0) return NextResponse.json({ overdue: [] });

    // nomes dos clientes (prefere o nome da Página do Facebook)
    const groups = [...new Set(overdue.map((p) => p.group_key))];
    const { data: accs } = await getSupabaseAdmin()
      .from("social_accounts")
      .select("group_key, name, platform")
      .in("group_key", groups);
    const nameOf = (g: string) => {
      const rows = (accs ?? []).filter((a) => a.group_key === g);
      return rows.find((a) => a.platform === "facebook")?.name || rows[0]?.name || "Cliente";
    };

    return NextResponse.json({
      overdue: overdue.map((p) => ({
        id: p.id,
        planned_date: p.planned_date,
        title: p.title || p.caption || "(sem título)",
        client: nameOf(p.group_key),
      })),
    });
  } catch {
    return NextResponse.json({ overdue: [] });
  }
}
