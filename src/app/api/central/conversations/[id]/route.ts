import { NextResponse } from "next/server";
import { supabaseConfigured } from "@/lib/supabase";
import { currentAgent, canAttend } from "@/lib/central/guard";
import {
  getConversation,
  getMailbox,
  insertMessage,
  lastIncoming,
  listMessages,
  markConversationRead,
  normalizeSubject,
  setConversationStatus,
  touchConversation,
} from "@/lib/central/db";
import { sendMail } from "@/lib/central/smtp";
import type { ConversationStatus } from "@/lib/central/types";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/** Abre a conversa (mensagens) e marca como lida. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!supabaseConfigured) return NextResponse.json({ error: "Supabase não configurado" }, { status: 500 });
  if (!canAttend((await currentAgent()).level)) {
    return NextResponse.json({ error: "Acesso restrito." }, { status: 403 });
  }
  const { id } = await params;
  try {
    const conversation = await getConversation(id);
    if (!conversation) return NextResponse.json({ error: "Conversa não encontrada." }, { status: 404 });
    const messages = await listMessages(id);
    await markConversationRead(id);
    return NextResponse.json({ conversation, messages });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

/** Responde o contato por e-mail (SMTP) e grava a resposta. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!supabaseConfigured) return NextResponse.json({ error: "Supabase não configurado" }, { status: 500 });
  const agent = await currentAgent();
  if (!canAttend(agent.level)) return NextResponse.json({ error: "Acesso restrito." }, { status: 403 });

  const { id } = await params;
  let text = "";
  try {
    const body = await req.json();
    text = typeof body?.text === "string" ? body.text.trim() : "";
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  if (!text) return NextResponse.json({ error: "Escreva a resposta." }, { status: 400 });

  try {
    const conversation = await getConversation(id);
    if (!conversation) return NextResponse.json({ error: "Conversa não encontrada." }, { status: 404 });
    const mailbox = await getMailbox(conversation.mailbox_id);
    if (!mailbox) return NextResponse.json({ error: "Caixa não encontrada." }, { status: 404 });

    const last = await lastIncoming(id);
    const subject = `Re: ${normalizeSubject(conversation.subject)}`;
    const to = conversation.contact_email;

    const sent = await sendMail(mailbox, {
      to,
      subject,
      text,
      inReplyTo: last?.message_id ?? undefined,
      references: last?.message_id ?? undefined,
    });

    const nowIso = new Date().toISOString();
    await insertMessage({
      conversation_id: id,
      direction: "out",
      from_email: mailbox.email,
      from_name: mailbox.label,
      to_email: to,
      subject,
      body_text: text,
      message_id: sent.messageId ?? null,
      in_reply_to: last?.message_id ?? null,
      author_email: agent.email,
      sent_at: nowIso,
    });
    await touchConversation(id, { last_message_at: nowIso, unread: false, status: "pendente" });

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: `Falha ao enviar: ${(e as Error).message}` }, { status: 500 });
  }
}

/** Muda o status da conversa (aberto / pendente / resolvido). */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!supabaseConfigured) return NextResponse.json({ error: "Supabase não configurado" }, { status: 500 });
  if (!canAttend((await currentAgent()).level)) {
    return NextResponse.json({ error: "Acesso restrito." }, { status: 403 });
  }
  const { id } = await params;
  let status = "";
  try {
    const body = await req.json();
    status = typeof body?.status === "string" ? body.status : "";
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  if (!["aberto", "pendente", "resolvido"].includes(status)) {
    return NextResponse.json({ error: "Status inválido." }, { status: 400 });
  }
  try {
    await setConversationStatus(id, status as ConversationStatus);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
