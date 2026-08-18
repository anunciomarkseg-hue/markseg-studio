import { getSupabaseAdmin } from "@/lib/supabase";
import type {
  Conversation,
  ConversationStatus,
  Mailbox,
  MailboxSafe,
  Message,
} from "./types";

/** Remove Re:/Fwd:/Enc: e espaços — vira a "chave" da thread. */
export function normalizeSubject(raw: string | null | undefined): string {
  const s = (raw ?? "").replace(/^(\s*(re|fwd|fw|enc|res)\s*:\s*)+/i, "").trim();
  return s.slice(0, 300) || "(sem assunto)";
}

const MAILBOX_COLS =
  "id,label,email,color,imap_host,imap_port,imap_user,imap_pass,imap_tls,smtp_host,smtp_port,smtp_user,smtp_pass,smtp_secure,last_uid,active,last_synced_at,last_error,created_at";

/** Caixas completas (com segredos) — SÓ servidor. */
export async function listMailboxes(activeOnly = false): Promise<Mailbox[]> {
  const sb = getSupabaseAdmin();
  let q = sb.from("central_mailboxes").select(MAILBOX_COLS).order("created_at", { ascending: true });
  if (activeOnly) q = q.eq("active", true);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as Mailbox[];
}

export async function getMailbox(id: string): Promise<Mailbox | null> {
  const sb = getSupabaseAdmin();
  const { data } = await sb.from("central_mailboxes").select(MAILBOX_COLS).eq("id", id).maybeSingle();
  return (data as Mailbox) ?? null;
}

/** Lista sem segredos — pode ir pro navegador. */
export async function listMailboxesSafe(): Promise<MailboxSafe[]> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("central_mailboxes")
    .select("id,label,email,color,active,last_synced_at,last_error")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as MailboxSafe[];
}

export async function createMailbox(input: Omit<Mailbox, "id" | "last_uid" | "last_synced_at" | "last_error" | "created_at">): Promise<string> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb.from("central_mailboxes").insert(input).select("id").single();
  if (error) throw error;
  return data.id as string;
}

export async function deleteMailbox(id: string): Promise<void> {
  const sb = getSupabaseAdmin();
  const { error } = await sb.from("central_mailboxes").delete().eq("id", id);
  if (error) throw error;
}

export async function updateMailboxSync(
  id: string,
  patch: Partial<Pick<Mailbox, "last_uid" | "last_synced_at" | "last_error">>,
): Promise<void> {
  const sb = getSupabaseAdmin();
  await sb.from("central_mailboxes").update(patch).eq("id", id);
}

/** Acha (ou cria) a conversa da thread por caixa + contato + assunto normalizado. */
export async function findOrCreateConversation(input: {
  mailbox_id: string;
  contact_email: string;
  contact_name?: string | null;
  subject: string;
}): Promise<string> {
  const sb = getSupabaseAdmin();
  const subject = normalizeSubject(input.subject);
  const contact_email = input.contact_email.toLowerCase();
  const { data: found } = await sb
    .from("central_conversations")
    .select("id")
    .eq("mailbox_id", input.mailbox_id)
    .eq("contact_email", contact_email)
    .eq("subject", subject)
    .limit(1)
    .maybeSingle();
  if (found) return found.id as string;

  const { data: created, error } = await sb
    .from("central_conversations")
    .insert({
      mailbox_id: input.mailbox_id,
      contact_email,
      contact_name: input.contact_name ?? null,
      subject,
    })
    .select("id")
    .single();
  if (error) throw error;
  return created.id as string;
}

/** Já existe uma mensagem com esse Message-ID? (dedup) */
export async function messageExists(messageId: string): Promise<boolean> {
  const sb = getSupabaseAdmin();
  const { data } = await sb.from("central_messages").select("id").eq("message_id", messageId).limit(1).maybeSingle();
  return Boolean(data);
}

export async function insertMessage(input: Partial<Message> & { conversation_id: string; direction: "in" | "out" }): Promise<void> {
  const sb = getSupabaseAdmin();
  const { error } = await sb.from("central_messages").insert(input);
  if (error) throw error;
}

/** Atualiza a conversa quando chega/sai mensagem. */
export async function touchConversation(
  id: string,
  patch: { last_message_at: string; unread?: boolean; status?: ConversationStatus },
): Promise<void> {
  const sb = getSupabaseAdmin();
  await sb.from("central_conversations").update(patch).eq("id", id);
}

export interface ConversationRow extends Conversation {
  mailbox_label: string;
  mailbox_color: string;
  preview: string;
}

/** Lista conversas (com prévia da última mensagem) pro painel. */
export async function listConversations(filter: {
  mailboxId?: string;
  status?: ConversationStatus;
  limit?: number;
}): Promise<ConversationRow[]> {
  const sb = getSupabaseAdmin();
  let q = sb
    .from("central_conversations")
    .select("*, central_mailboxes(label,color)")
    .order("last_message_at", { ascending: false })
    .limit(filter.limit ?? 100);
  if (filter.mailboxId) q = q.eq("mailbox_id", filter.mailboxId);
  if (filter.status) q = q.eq("status", filter.status);
  const { data, error } = await q;
  if (error) throw error;

  const rows = (data ?? []) as (Conversation & { central_mailboxes?: { label: string; color: string } })[];
  // prévia: última mensagem de cada conversa
  const ids = rows.map((r) => r.id);
  const previews = new Map<string, string>();
  if (ids.length) {
    const { data: msgs } = await sb
      .from("central_messages")
      .select("conversation_id, body_text, sent_at")
      .in("conversation_id", ids)
      .order("sent_at", { ascending: false });
    for (const m of msgs ?? []) {
      if (!previews.has(m.conversation_id)) {
        previews.set(m.conversation_id, (m.body_text ?? "").replace(/\s+/g, " ").slice(0, 140));
      }
    }
  }

  return rows.map((r) => ({
    ...r,
    mailbox_label: r.central_mailboxes?.label ?? "",
    mailbox_color: r.central_mailboxes?.color ?? "gradient-blue",
    preview: previews.get(r.id) ?? "",
  }));
}

export async function getConversation(id: string): Promise<Conversation | null> {
  const sb = getSupabaseAdmin();
  const { data } = await sb.from("central_conversations").select("*").eq("id", id).maybeSingle();
  return (data as Conversation) ?? null;
}

export async function listMessages(conversationId: string): Promise<Message[]> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("central_messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("sent_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Message[];
}

export async function markConversationRead(id: string): Promise<void> {
  const sb = getSupabaseAdmin();
  await sb.from("central_conversations").update({ unread: false }).eq("id", id);
}

export async function setConversationStatus(id: string, status: ConversationStatus): Promise<void> {
  const sb = getSupabaseAdmin();
  await sb.from("central_conversations").update({ status }).eq("id", id);
}

/** Última mensagem recebida (pra montar o cabeçalho da resposta). */
export async function lastIncoming(conversationId: string): Promise<Message | null> {
  const sb = getSupabaseAdmin();
  const { data } = await sb
    .from("central_messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .eq("direction", "in")
    .order("sent_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as Message) ?? null;
}
