import { NextResponse } from "next/server";
import { supabaseConfigured } from "@/lib/supabase";
import { currentAgent } from "@/lib/central/guard";
import { getMailbox, listMailboxes } from "@/lib/central/db";
import { fetchMailbox } from "@/lib/central/imap";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Sincroniza agora (manual), pra testar sem esperar o cron. Só admin.
 *  Body opcional { mailboxId } pra sincronizar só uma caixa. */
export async function POST(req: Request) {
  if (!supabaseConfigured) return NextResponse.json({ error: "Supabase não configurado" }, { status: 500 });
  if ((await currentAgent()).level !== "admin") {
    return NextResponse.json({ error: "Só administradores podem sincronizar." }, { status: 403 });
  }

  let mailboxId = "";
  try {
    const body = await req.json();
    mailboxId = typeof body?.mailboxId === "string" ? body.mailboxId : "";
  } catch {
    /* sem body — sincroniza todas */
  }

  try {
    const boxes = mailboxId ? [await getMailbox(mailboxId)].filter(Boolean) : await listMailboxes(true);
    const results: { mailbox: string; fetched: number; error?: string }[] = [];
    const started = Date.now();
    for (const box of boxes) {
      if (!box) continue;
      if (Date.now() - started > 50000) break;
      const r = await fetchMailbox(box, { maxMessages: 40 });
      results.push({ mailbox: box.email, fetched: r.fetched, error: r.error });
    }
    const novos = results.reduce((s, r) => s + r.fetched, 0);
    return NextResponse.json({ ok: true, novos, results });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
