import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import type { Mailbox } from "./types";
import {
  findOrCreateConversation,
  insertMessage,
  messageExists,
  touchConversation,
  updateMailboxSync,
} from "./db";

/**
 * Puxa e-mails novos de UMA caixa via IMAP e grava no banco.
 * Roda no servidor (Node), chamado pelo cron — a Vercel não mantém IMAP aberto.
 */
export async function fetchMailbox(
  m: Mailbox,
  opts: { maxMessages?: number } = {},
): Promise<{ fetched: number; error?: string }> {
  const max = opts.maxMessages ?? 40;
  // Gmail mostra a senha de app com espaços ("abcd efgh ijkl mnop") — se colar
  // assim, o login falha. Tiramos os espaços no Gmail pra evitar essa pegadinha.
  const pass = /gmail|googlemail/i.test(m.imap_host) ? m.imap_pass.replace(/\s+/g, "") : m.imap_pass;
  const client = new ImapFlow({
    host: m.imap_host,
    port: m.imap_port,
    secure: m.imap_tls,
    auth: { user: m.imap_user, pass },
    logger: false,
  });

  let fetched = 0;
  let maxUid = m.last_uid;

  try {
    await client.connect();
    const lock = await client.getMailboxLock("INBOX");
    try {
      const status = await client.status("INBOX", { uidNext: true });
      const uidNext = Number(status.uidNext ?? 1);
      // 1ª sincronização: pega só as ~20 últimas (não puxa anos de histórico).
      const startUid = m.last_uid > 0 ? m.last_uid + 1 : Math.max(1, uidNext - 20);
      if (startUid >= uidNext) {
        await updateMailboxSync(m.id, { last_synced_at: new Date().toISOString(), last_error: null });
        return { fetched: 0 };
      }

      for await (const msg of client.fetch(`${startUid}:*`, { source: true }, { uid: true })) {
        if (fetched >= max) break;
        const uid = Number(msg.uid);
        if (uid > maxUid) maxUid = uid;
        if (!msg.source) continue;
        try {
          await storeIncoming(m, msg.source as Buffer);
          fetched++;
        } catch {
          /* uma mensagem ruim não derruba o lote */
        }
      }

      await updateMailboxSync(m.id, {
        last_uid: Math.max(maxUid, m.last_uid),
        last_synced_at: new Date().toISOString(),
        last_error: null,
      });
    } finally {
      lock.release();
    }
  } catch (e) {
    const err = e as { message?: string; responseText?: string; response?: string; authenticationFailed?: boolean };
    let error = err.responseText || err.response || err.message || "Erro desconhecido";
    if (err.authenticationFailed || /AUTHENTICATIONFAILED|Invalid credentials|Username and Password not accepted|LOGIN failed/i.test(error)) {
      error =
        "Login recusado. Use uma SENHA DE APP (a senha normal do Gmail não funciona) e confirme que o IMAP está habilitado nas configs do e-mail.";
    } else if (/ENOTFOUND|EAI_AGAIN|ECONNREFUSED|ETIMEDOUT/i.test(error)) {
      error = "Não consegui conectar no servidor IMAP. Confira o endereço e a porta.";
    }
    await updateMailboxSync(m.id, { last_error: error, last_synced_at: new Date().toISOString() });
    return { fetched, error };
  } finally {
    try {
      await client.logout();
    } catch {
      /* ignora erro ao encerrar */
    }
  }

  return { fetched };
}

async function storeIncoming(m: Mailbox, source: Buffer): Promise<void> {
  const parsed = await simpleParser(source);
  const messageId = parsed.messageId ?? null;
  if (messageId && (await messageExists(messageId))) return; // já temos

  const from = parsed.from?.value?.[0];
  const contactEmail = (from?.address ?? "desconhecido@sem-email").toLowerCase();
  const contactName = from?.name || null;
  const subject = parsed.subject ?? "(sem assunto)";
  const sentAt = (parsed.date ?? new Date()).toISOString();

  const conversationId = await findOrCreateConversation({
    mailbox_id: m.id,
    contact_email: contactEmail,
    contact_name: contactName,
    subject,
  });

  await insertMessage({
    conversation_id: conversationId,
    direction: "in",
    from_email: contactEmail,
    from_name: contactName,
    to_email: m.email,
    subject,
    body_text: parsed.text ?? textFromHtml(parsed.html),
    body_html: typeof parsed.html === "string" ? parsed.html : null,
    message_id: messageId,
    in_reply_to: (Array.isArray(parsed.inReplyTo) ? parsed.inReplyTo[0] : parsed.inReplyTo) ?? null,
    sent_at: sentAt,
  });

  await touchConversation(conversationId, { last_message_at: sentAt, unread: true, status: "aberto" });
}

function textFromHtml(html: string | false): string | null {
  if (!html) return null;
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
