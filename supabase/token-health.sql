-- ============================================================
--  MarkSeg Studio — Saúde do token das contas Meta
--  Sinaliza contas cujo acesso (token) caducou, pra avisar antes de postar.
--  Supabase → SQL Editor → cole → Run.
-- ============================================================

alter table social_accounts
  add column if not exists needs_reconnect boolean not null default false;

alter table social_accounts
  add column if not exists token_error text;
