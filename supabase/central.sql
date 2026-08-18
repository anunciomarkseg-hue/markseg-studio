-- ============================================================
--  MarkSeg Studio — Central de Atendimento (módulo isolado)
--  Tabelas com prefixo central_ — NÃO tocam nas tabelas do Studio.
--  Como usar: Supabase → SQL Editor → cole tudo → Run.
-- ============================================================

create extension if not exists pgcrypto;

-- ------------------------------------------------------------
-- Caixas de e-mail conectadas (IMAP p/ receber, SMTP p/ enviar)
-- ⚠️ As senhas ficam aqui e só são lidas pelo servidor (service role).
--    Use "senha de app" do provedor, nunca a senha principal.
-- ------------------------------------------------------------
create table if not exists central_mailboxes (
  id           uuid primary key default gen_random_uuid(),
  label        text not null,                         -- "Suporte Gmail"
  email        text not null,                         -- endereço mostrado
  color        text not null default 'gradient-blue', -- cor do rótulo
  imap_host    text not null,
  imap_port    int  not null default 993,
  imap_user    text not null,
  imap_pass    text not null,
  imap_tls     boolean not null default true,
  smtp_host    text not null,
  smtp_port    int  not null default 465,
  smtp_user    text not null,
  smtp_pass    text not null,
  smtp_secure  boolean not null default true,
  last_uid     bigint not null default 0,             -- último UID já baixado
  active       boolean not null default true,
  last_synced_at timestamptz,
  last_error   text,
  created_at   timestamptz not null default now()
);

-- ------------------------------------------------------------
-- Conversas (uma thread por contato+assunto dentro de uma caixa)
-- ------------------------------------------------------------
create table if not exists central_conversations (
  id            uuid primary key default gen_random_uuid(),
  mailbox_id    uuid not null references central_mailboxes(id) on delete cascade,
  subject       text not null default '(sem assunto)',
  contact_email text not null,
  contact_name  text,
  status        text not null default 'aberto'
                  check (status in ('aberto','pendente','resolvido')),
  unread        boolean not null default true,
  last_message_at timestamptz not null default now(),
  assigned_to   text,                                 -- e-mail do atendente (opcional)
  created_at    timestamptz not null default now()
);

create index if not exists idx_central_conv_mailbox
  on central_conversations (mailbox_id, last_message_at desc);
create index if not exists idx_central_conv_thread
  on central_conversations (mailbox_id, contact_email, subject);

-- ------------------------------------------------------------
-- Mensagens (entrada = recebida; saída = resposta nossa)
-- ------------------------------------------------------------
create table if not exists central_messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references central_conversations(id) on delete cascade,
  direction       text not null check (direction in ('in','out')),
  from_email      text,
  from_name       text,
  to_email        text,
  subject         text,
  body_text       text,
  body_html       text,
  message_id      text,                               -- Message-ID do e-mail (dedup)
  in_reply_to     text,
  author_email    text,                               -- quem respondeu (saída)
  sent_at         timestamptz not null default now(),
  created_at      timestamptz not null default now()
);

-- não duplica a mesma mensagem recebida
create unique index if not exists idx_central_msg_msgid
  on central_messages (message_id)
  where message_id is not null;

create index if not exists idx_central_msg_conv
  on central_messages (conversation_id, sent_at);
