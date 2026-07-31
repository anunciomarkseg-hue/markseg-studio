-- ============================================================
--  MarkSeg Studio — Schema do banco (Supabase / Postgres)
--  Como usar: Supabase → SQL Editor → cole tudo → Run.
-- ============================================================

-- gen_random_uuid()
create extension if not exists pgcrypto;

-- ------------------------------------------------------------
-- Contas sociais conectadas (Instagram / Facebook)
-- ------------------------------------------------------------
create table if not exists social_accounts (
  id            uuid primary key default gen_random_uuid(),
  platform      text not null check (platform in ('instagram','facebook')),
  handle        text not null,                 -- @markseg
  name          text not null,                 -- MarkSeg
  external_id   text,                          -- IG user id / FB page id
  access_token  text,                          -- token (página/longa duração)
  token_expires_at timestamptz,
  followers     int  not null default 0,
  avatar        text not null default 'gradient-blue', -- classe de degradê (placeholder)
  created_at    timestamptz not null default now()
);

-- ------------------------------------------------------------
-- Publicações (rascunho / agendada / publicada ...)
-- ------------------------------------------------------------
create table if not exists scheduled_posts (
  id            uuid primary key default gen_random_uuid(),
  caption       text not null default '',
  media_type    text not null default 'imagem'
                  check (media_type in ('imagem','carrossel','video','reel','story')),
  media_urls    text[] not null default '{}',  -- URLs públicas (temporárias)
  storage_paths text[] not null default '{}',  -- caminhos no bucket p/ apagar após publicar
  scheduled_for timestamptz not null,
  status        text not null default 'rascunho'
                  check (status in ('rascunho','agendado','aguardando','publicado','falhou')),
  published_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists idx_posts_due
  on scheduled_posts (scheduled_for)
  where status = 'agendado';

-- ------------------------------------------------------------
-- Destino por conta (1 post -> N contas) com status individual
-- (um post pode dar certo no IG e falhar no FB)
-- ------------------------------------------------------------
create table if not exists post_targets (
  id               uuid primary key default gen_random_uuid(),
  post_id          uuid not null references scheduled_posts(id) on delete cascade,
  account_id       uuid not null references social_accounts(id) on delete cascade,
  status           text not null default 'agendado'
                     check (status in ('agendado','publicado','falhou')),
  external_post_id text,           -- id retornado pela Meta
  error_message    text,
  published_at     timestamptz,
  unique (post_id, account_id)
);

-- ------------------------------------------------------------
-- updated_at automático
-- ------------------------------------------------------------
create or replace function touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists trg_posts_touch on scheduled_posts;
create trigger trg_posts_touch
  before update on scheduled_posts
  for each row execute function touch_updated_at();

-- ------------------------------------------------------------
-- Bucket de mídia (público; arquivos são apagados após publicar)
-- ------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do nothing;

-- ------------------------------------------------------------
-- RLS: ligada nas tabelas. Nosso back-end usa a SERVICE ROLE KEY,
-- que ignora RLS. O navegador nunca acessa o banco direto
-- (tudo passa pelas nossas rotas /api). Sem políticas públicas.
-- ------------------------------------------------------------
alter table social_accounts enable row level security;
alter table scheduled_posts enable row level security;
alter table post_targets    enable row level security;

-- ------------------------------------------------------------
-- (Opcional p/ teste) contas de exemplo — SEM token real ainda.
-- Apague depois que conectar as contas de verdade pelo OAuth.
-- ------------------------------------------------------------
insert into social_accounts (platform, handle, name, followers, avatar)
values
  ('instagram', '@markseg', 'MarkSeg', 12840, 'gradient-orange'),
  ('facebook',  'MarkSeg',  'MarkSeg — Marketing para Segurança', 8420, 'gradient-blue')
on conflict do nothing;
