import { NextResponse } from "next/server";
import { supabaseConfigured } from "@/lib/supabase";
import { currentAgent, canAttend } from "@/lib/central/guard";
import { listConversations } from "@/lib/central/db";
import type { ConversationStatus } from "@/lib/central/types";

export const dynamic = "force-dynamic";

/** Lista as conversas do painel (atendentes = admin/editor). */
export async function GET(req: Request) {
  if (!supabaseConfigured) return NextResponse.json({ error: "Supabase não configurado" }, { status: 500 });
  if (!canAttend((await currentAgent()).level)) {
    return NextResponse.json({ error: "Acesso restrito." }, { status: 403 });
  }
  const url = new URL(req.url);
  const mailboxId = url.searchParams.get("mailbox") || undefined;
  const statusRaw = url.searchParams.get("status") || "";
  const status = (["aberto", "pendente", "resolvido"].includes(statusRaw)
    ? statusRaw
    : undefined) as ConversationStatus | undefined;
  try {
    return NextResponse.json({ conversations: await listConversations({ mailboxId, status }) });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
