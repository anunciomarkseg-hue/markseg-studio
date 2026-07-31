import { NextResponse } from "next/server";
import { getSupabaseAdmin, supabaseConfigured } from "@/lib/supabase";
import { getClientInsights } from "@/lib/insights";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  if (!supabaseConfigured) {
    return NextResponse.json({ error: "Supabase não configurado" }, { status: 500 });
  }
  const url = new URL(req.url);
  const group = url.searchParams.get("group");
  const days = Math.min(90, Math.max(1, parseInt(url.searchParams.get("days") || "30", 10)));
  const networkParam = url.searchParams.get("network") || "all";
  const network = (["all", "instagram", "facebook"].includes(networkParam) ? networkParam : "all") as
    | "all"
    | "instagram"
    | "facebook";
  if (!group) {
    return NextResponse.json({ error: "group obrigatório" }, { status: 400 });
  }

  const { data: accounts } = await getSupabaseAdmin()
    .from("social_accounts")
    .select("platform, external_id, access_token")
    .eq("group_key", group);
  if (!accounts || accounts.length === 0) {
    return NextResponse.json({ error: "cliente sem contas" }, { status: 404 });
  }

  try {
    const insights = await getClientInsights(accounts, days, network);
    return NextResponse.json({ insights });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
