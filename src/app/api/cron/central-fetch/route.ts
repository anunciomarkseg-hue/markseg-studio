import { NextResponse } from "next/server";
import { supabaseConfigured } from "@/lib/supabase";
import { listMailboxes } from "@/lib/central/db";
import { fetchMailbox } from "@/lib/central/imap";

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

/** Puxa e-mails novos de todas as caixas ativas. Chamado pelo agendador. */
async function run(req: Request) {
  if (!supabaseConfigured) {
    return NextResponse.json({ error: "Supabase não configurado" }, { status: 500 });
  }
  if (!authorized(req)) {
    return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  }

  const started = Date.now();
  const boxes = await listMailboxes(true);
  const results: { mailbox: string; fetched: number; error?: string }[] = [];

  for (const box of boxes) {
    if (Date.now() - started > 50000) break; // respeita o limite de tempo da função
    const r = await fetchMailbox(box, { maxMessages: 40 });
    results.push({ mailbox: box.email, fetched: r.fetched, error: r.error });
  }

  const total = results.reduce((s, r) => s + r.fetched, 0);
  return NextResponse.json({ ok: true, mailboxes: results.length, novos: total, results });
}

export async function GET(req: Request) {
  return run(req);
}
export async function POST(req: Request) {
  return run(req);
}
