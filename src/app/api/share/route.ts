import { NextResponse } from "next/server";
import { createShare } from "@/lib/db";
import { supabaseConfigured } from "@/lib/supabase";

export const dynamic = "force-dynamic";

function appOrigin(req: Request): string {
  const h = req.headers;
  const proto = h.get("x-forwarded-proto") ?? "http";
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  return `${proto}://${host}`;
}

export async function POST(req: Request) {
  if (!supabaseConfigured) {
    return NextResponse.json({ error: "Supabase não configurado" }, { status: 500 });
  }
  const body = (await req.json().catch(() => ({}))) as { group?: string; days?: number; network?: string };
  const group = typeof body.group === "string" ? body.group : "";
  const days = Math.min(90, Math.max(1, Number(body.days) || 30));
  const network = ["all", "instagram", "facebook"].includes(body.network || "") ? body.network! : "all";
  if (!group) {
    return NextResponse.json({ error: "group obrigatório" }, { status: 400 });
  }
  try {
    const token = await createShare(group, days, network);
    return NextResponse.json({ token, url: `${appOrigin(req)}/r/${token}` });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
