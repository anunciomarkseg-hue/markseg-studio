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

-- ============================================================
--  CALENDÁRIO EDITORIAL VISUAL (separado do fluxo de aprovação)
--  Ferramenta: sobe 1 pauta em PDF por cliente -> vira calendário
--  visual pra compartilhar com o cliente (link público read-only).
--  Rode este bloco no SQL Editor do Supabase.
-- ============================================================

create table if not exists editorial_calendars (
  id           uuid primary key default gen_random_uuid(),
  group_key    text not null,                 -- cliente (mesmo group_key das contas)
  title        text not null default '',      -- ex: "Agosto 2026"
  theme        text not null default '',      -- tema do mês (opcional)
  ref_year     int,
  ref_month    int,                           -- 1-12
  source_name  text,                          -- nome do PDF de origem
  token        text not null unique,          -- link público /cal/[token]
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists idx_cal_group on editorial_calendars (group_key);

create table if not exists editorial_calendar_posts (
  id           uuid primary key default gen_random_uuid(),
  calendar_id  uuid not null references editorial_calendars(id) on delete cascade,
  ref          text not null default '',
  planned_date timestamptz not null,
  format       text not null default 'feed',  -- feed | carrossel | reel | story
  title        text not null default '',
  brief        text not null default '',
  networks     text[] not null default '{}',
  sort         int not null default 0
);

create index if not exists idx_cal_posts_cal  on editorial_calendar_posts (calendar_id, planned_date);
create index if not exists idx_cal_posts_date on editorial_calendar_posts (planned_date);

-- updated_at automático no calendário
drop trigger if exists trg_cal_touch on editorial_calendars;
create trigger trg_cal_touch
  before update on editorial_calendars
  for each row execute function touch_updated_at();

-- RLS ligada (back-end usa service role e ignora; navegador nunca acessa direto)
alter table editorial_calendars      enable row level security;
alter table editorial_calendar_posts enable row level security;

-- Status de publicação por post do calendário visual (manual):
-- pendente | publicado | erro  ("atrasado" é derivado: pendente + data vencida)
alter table editorial_calendar_posts
  add column if not exists status text not null default 'pendente';

-- Nome do cliente do calendário (digitado no upload; NÃO exige conta conectada
-- na Meta). Permite criar calendário visual pra qualquer cliente.
alter table editorial_calendars
  add column if not exists client_name text not null default '';

-- Anti-duplicação: hora da 1ª tentativa de publicar cada alvo. Em recuperação
-- (função cortada após publicar), serve de âncora pra guarda por horário —
-- evita o post sair 2x quando a legenda é vazia/curta.
alter table post_targets
  add column if not exists attempted_at timestamptz;

-- ============================================================
--  COFRE DE ACESSOS (senhas dos clientes + internas da agência)
--  Rode este bloco no SQL Editor do Supabase.
--
--  Regras:
--   • As SENHAS ficam CRIPTOGRAFADAS (AES-256-GCM) — o app usa a env
--     VAULT_SECRET pra cifrar/decifrar. O banco só guarda o texto embaralhado.
--   • RLS ligada; o back-end usa a service role e o navegador NUNCA acessa
--     o banco direto. Só quem tem nível suficiente revela cada senha.
--   • Dois mundos: scope 'interno' (agência) e 'cliente' (nunca se misturam).
--   • 3 níveis de sigilo por pasta:
--       'dono'   → só os donos (lista ADMIN_EMAILS). Ex.: bancos.
--       'admin'  → administradores.
--       'equipe' → admin + editor (quem opera as contas).
-- ============================================================

-- Pastas do cofre (a unidade de organização + o nível de sigilo)
create table if not exists vault_folders (
  id          uuid primary key default gen_random_uuid(),
  scope       text not null default 'cliente'
                check (scope in ('interno','cliente')),
  name        text not null,                 -- "DBP Cleaning" ou "Bancos da agência"
  sensitivity text not null default 'equipe'
                check (sensitivity in ('dono','admin','equipe')),
  notes       text not null default '',      -- observações livres da pasta
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists idx_vault_folders_scope on vault_folders (scope, name);

-- Acessos (1 linha = 1 senha: Gmail, Meta Ads, WordPress...)
create table if not exists vault_credentials (
  id           uuid primary key default gen_random_uuid(),
  folder_id    uuid not null references vault_folders(id) on delete cascade,
  category     text not null default 'outros', -- ferramentas|emails|bancos|redes|hospedagem|outros
  label        text not null,                  -- "Gmail", "Meta Ads"
  url          text not null default '',       -- link do painel (opcional)
  username     text not null default '',       -- login/e-mail (NÃO é segredo → texto)
  password_enc text not null default '',       -- SENHA cifrada (base64) — pode ser vazia
  extra_enc    text not null default '',       -- 2FA/observação cifrada — pode ser vazia
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists idx_vault_cred_folder on vault_credentials (folder_id, label);

-- Log de quem revelou qual senha (auditoria — o que a planilha nunca teve).
-- Guarda um "retrato" do label/pasta pra sobreviver a exclusões.
create table if not exists vault_access_log (
  id               uuid primary key default gen_random_uuid(),
  credential_id    uuid references vault_credentials(id) on delete set null,
  credential_label text not null default '',
  folder_name      text not null default '',
  user_email       text not null default '',
  action           text not null default 'reveal', -- reveal | copy
  at               timestamptz not null default now()
);

create index if not exists idx_vault_log_at on vault_access_log (at desc);

-- "toca" updated_at ao editar pasta/acesso
create or replace function vault_touch() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_vault_folders_touch on vault_folders;
create trigger trg_vault_folders_touch
  before update on vault_folders
  for each row execute function vault_touch();

drop trigger if exists trg_vault_cred_touch on vault_credentials;
create trigger trg_vault_cred_touch
  before update on vault_credentials
  for each row execute function vault_touch();

-- RLS ligada (back-end usa service role e ignora; navegador nunca acessa direto)
alter table vault_folders     enable row level security;
alter table vault_credentials enable row level security;
alter table vault_access_log  enable row level security;
