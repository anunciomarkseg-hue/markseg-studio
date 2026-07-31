import { NextResponse } from "next/server";
import { createEditorial } from "@/lib/editorial";
import { supabaseConfigured } from "@/lib/supabase";
import type { ProductionStatus } from "@/lib/editorial";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!supabaseConfigured) {
    return NextResponse.json({ error: "Supabase não configurado" }, { status: 500 });
  }
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const group_key = typeof body.group_key === "string" ? body.group_key : "";
  const planned_date = typeof body.planned_date === "string" ? body.planned_date : "";
  if (!group_key) return NextResponse.json({ error: "Selecione um cliente" }, { status: 400 });
  if (!planned_date || Number.isNaN(Date.parse(planned_date))) {
    return NextResponse.json({ error: "Data inválida" }, { status: 400 });
  }

  try {
    const id = await createEditorial({
      group_key,
      planned_date,
      networks: Array.isArray(body.networks) ? (body.networks as string[]) : [],
      format: typeof body.format === "string" ? body.format : "feed",
      title: typeof body.title === "string" ? body.title : "",
      caption: typeof body.caption === "string" ? body.caption : "",
      brief: typeof body.brief === "string" ? body.brief : "",
      reference_urls: Array.isArray(body.reference_urls)
        ? (body.reference_urls as unknown[]).filter((u): u is string => typeof u === "string")
        : [],
      production_status: (["briefing", "em_producao", "pronto"].includes(body.production_status as string)
        ? body.production_status
        : "briefing") as ProductionStatus,
    });
    return NextResponse.json({ ok: true, id }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
