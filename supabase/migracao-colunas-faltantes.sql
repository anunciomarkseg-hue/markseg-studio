-- ============================================================
--  MarkSeg Studio — Alinha o banco EXISTENTE com o código
--
--  Contexto: várias colunas foram criadas à mão no Supabase ao longo do tempo
--  e nunca entraram no schema.sql. Resultado: o banco de produção funciona,
--  mas um banco novo montado pelo schema do repositório NÃO publicaria nada.
--
--  Este arquivo é seguro rodar a qualquer momento (tudo é "if not exists"):
--  no banco atual ele não muda nada que já esteja certo; num banco novo, ele
--  completa o que falta.
--
--  Como usar: Supabase → SQL Editor → cole tudo → Run.
-- ============================================================

-- ---------- scheduled_posts ----------
alter table scheduled_posts add column if not exists cover_url     text;
alter table scheduled_posts add column if not exists collaborators text[] not null default '{}';
alter table scheduled_posts add column if not exists share_to_feed boolean not null default false;
alter table scheduled_posts add column if not exists created_by    text;
alter table scheduled_posts add column if not exists media_deleted boolean not null default false;
-- trava anti-duplicação: sem esta coluna, publicar quebra ou nunca publica
alter table scheduled_posts add column if not exists publish_lock  timestamptz;

-- ---------- post_targets ----------
-- guarda o container do Reel enquanto o Instagram processa o vídeo
alter table post_targets add column if not exists ig_container_id text;

-- ---------- social_accounts ----------
-- TikTok: o access_token expira em ~24h e é renovado pelo refresh_token
alter table social_accounts add column if not exists refresh_token   text;
-- saúde do token (avisa quando a conta precisa ser reconectada)
alter table social_accounts add column if not exists needs_reconnect boolean not null default false;
alter table social_accounts add column if not exists token_error     text;

-- O código conecta LinkedIn e TikTok, mas o CHECK original só aceitava
-- instagram/facebook — inserir uma conta dessas falharia.
do $$
begin
  alter table social_accounts drop constraint if exists social_accounts_platform_check;
  alter table social_accounts add constraint social_accounts_platform_check
    check (platform in ('instagram','facebook','linkedin','tiktok'));
exception when others then
  raise notice 'constraint de platform não ajustada: %', sqlerrm;
end $$;

-- ---------- índices que faltavam ----------
-- o agendador busca posts vencidos por status+data
create index if not exists idx_posts_status_data
  on scheduled_posts (status, scheduled_for);
-- a tela de status e a publicação buscam alvos por post
create index if not exists idx_targets_post
  on post_targets (post_id);
-- a guarda anti-duplicação busca por conta + status + data de publicação
create index if not exists idx_targets_conta_pub
  on post_targets (account_id, status, published_at desc);
