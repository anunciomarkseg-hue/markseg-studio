import nodemailer from "nodemailer";
import type { Mailbox } from "./types";

/** Envia um e-mail (resposta) pela caixa via SMTP. */
export async function sendMail(
  m: Mailbox,
  opts: { to: string; subject: string; text: string; inReplyTo?: string | null; references?: string | null },
): Promise<{ messageId: string }> {
  const pass = /gmail|googlemail/i.test(m.smtp_host) ? m.smtp_pass.replace(/\s+/g, "") : m.smtp_pass;
  const transport = nodemailer.createTransport({
    host: m.smtp_host,
    port: m.smtp_port,
    secure: m.smtp_secure,
    auth: { user: m.smtp_user, pass },
  });

  const info = await transport.sendMail({
    from: `"${m.label}" <${m.email}>`,
    to: opts.to,
    subject: opts.subject,
    text: opts.text,
    inReplyTo: opts.inReplyTo ?? undefined,
    references: opts.references ?? undefined,
  });

  return { messageId: info.messageId };
}
