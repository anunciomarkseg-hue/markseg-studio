export type ConversationStatus = "aberto" | "pendente" | "resolvido";
export type MessageDirection = "in" | "out";

export interface Mailbox {
  id: string;
  label: string;
  email: string;
  color: string;
  imap_host: string;
  imap_port: number;
  imap_user: string;
  imap_pass: string;
  imap_tls: boolean;
  smtp_host: string;
  smtp_port: number;
  smtp_user: string;
  smtp_pass: string;
  smtp_secure: boolean;
  last_uid: number;
  active: boolean;
  last_synced_at: string | null;
  last_error: string | null;
  created_at: string;
}

/** Versão sem segredos — segura pra mandar pro navegador. */
export interface MailboxSafe {
  id: string;
  label: string;
  email: string;
  color: string;
  active: boolean;
  last_synced_at: string | null;
  last_error: string | null;
}

export interface Conversation {
  id: string;
  mailbox_id: string;
  subject: string;
  contact_email: string;
  contact_name: string | null;
  status: ConversationStatus;
  unread: boolean;
  last_message_at: string;
  assigned_to: string | null;
  created_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  direction: MessageDirection;
  from_email: string | null;
  from_name: string | null;
  to_email: string | null;
  subject: string | null;
  body_text: string | null;
  body_html: string | null;
  message_id: string | null;
  in_reply_to: string | null;
  author_email: string | null;
  sent_at: string;
  created_at: string;
}
