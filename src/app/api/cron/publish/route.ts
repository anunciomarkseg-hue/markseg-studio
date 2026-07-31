import { NextResponse } from "next/server";
import { getSupabaseAdmin, supabaseConfigured } from "@/lib/supabase";
import { publishPost } from "@/lib/publish";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const url = new URL(req.url);
  return (
    url.searchParams.get("secret") === secret ||
    req.headers.get("authorization") === `Bearer ${secret}`
  );
}

/** Publica os posts agendados cuja hora já chegou. Chamado pelo agendador (pg_cron). */
async function run(req: Request) {
  if (!supabaseConfigured) {
    return NextResponse.json({ error: "Supabase não configurado" }, { status: 500 });
  }
  if (!authorized(req)) {
    return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  }

  const sb = getSupabaseAdmin();
  const nowIso = new Date().toISOString();
  const { data: due, error } = await sb
    .from("scheduled_posts")
    .select("id")
    .eq("status", "agendado")
    .lte("scheduled_for", nowIso)
    .order("scheduled_for", { ascending: true })
    .limit(10);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const started = Date.now();
  const results: { id: string; published?: number; processing?: number; error?: string }[] = [];
  for (const p of due ?? []) {
    if (Date.now() - started > 50000) break; // respeita o limite de tempo da função
    try {
      const r = await publishPost(p.id);
      results.push({ id: p.id, published: r.published, processing: r.processing });
    } catch (e) {
      results.push({ id: p.id, error: (e as Error).message });
    }
  }

  return NextResponse.json({ ok: true, ran: results.length, results });
}

export async function GET(req: Request) {
  return run(req);
}
export async function POST(req: Request) {
  return run(req);
}
