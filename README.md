# MarkSeg Studio

Ferramenta interna da **MarkSeg** para gestão de redes sociais dos clientes:
publicação e agendamento (Instagram, Facebook, LinkedIn, TikTok), pauta
editorial com aprovação do cliente, mural interno, relatórios, Cofre de senhas
e Central de Atendimento (e-mails).

**Stack:** Next.js 16 · React 19 · Tailwind v4 · Supabase (Postgres + Storage +
Auth) · Meta Graph API · Cloudflare R2 · Web Push (VAPID) · Deploy na Vercel.

---

## 🚨 Leia primeiro (para quem está assumindo o projeto)

Cinco coisas que, se ignoradas, quebram o sistema:

1. **`VAULT_SECRET` é a chave do Cofre.** Ela descriptografa as senhas
   guardadas. Se for **trocada ou perdida, todo o conteúdo do Cofre fica
   ilegível para sempre** — não há recuperação. Guarde uma cópia fora da Vercel.
2. **O agendador é externo.** A Vercel no plano atual não dispara cron de hora
   em hora. Um serviço de fora (cron-job.org / Upstash / similar) chama
   `/api/cron/publish?secret=<CRON_SECRET>`. **Se esse serviço parar, nenhum
   post agendado sai** — e ninguém é avisado. Veja "Agendador" abaixo.
3. **Os tokens da Meta caducam.** Quando isso acontece, as contas aparecem com
   o selo vermelho **"Reconecte"** em *Contas*, e a publicação falha até alguém
   entrar e clicar em **Reconectar**. É manutenção manual e periódica.
4. **Rode as migrações de banco.** Além de `schema.sql`, existem arquivos de
   migração em `supabase/` que precisam ser aplicados — veja "Banco de dados".
5. **Quem é admin vem da env `ADMIN_EMAILS`.** Sem ela, vale a lista embutida em
   `src/lib/admins.ts`. Admin acessa Equipe, Contas, Cofre e configura a Central.

---

## Rodar localmente

```bash
npm install
npm run dev
```

Antes, crie o arquivo **`.env.local`** na raiz (não vai pro Git). Os valores
estão no painel da Vercel (Settings → Environment Variables) e no gerenciador
de senhas da agência.

### Variáveis de ambiente

| Variável | Obrigatória | Para que serve |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | sim | endereço do Supabase (usado no navegador) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | sim | chave pública do Supabase (login) |
| `SUPABASE_URL` | sim | endereço do Supabase (servidor) |
| `SUPABASE_SERVICE_ROLE_KEY` | sim | chave de administrador do banco — **nunca** expor no navegador |
| `META_APP_ID` / `META_APP_SECRET` | sim | login e publicação no Instagram/Facebook |
| `META_GRAPH_VERSION` | não | versão da Graph API (padrão `v21.0`) |
| `LINKEDIN_CLIENT_ID` / `LINKEDIN_CLIENT_SECRET` | se usar LinkedIn | publicar em Página de empresa |
| `LINKEDIN_API_VERSION` | não | versão da API do LinkedIn (padrão `202405`) |
| `TIKTOK_CLIENT_KEY` / `TIKTOK_CLIENT_SECRET` | se usar TikTok | publicar vídeo |
| `TIKTOK_DEFAULT_PRIVACY` | não | `SELF_ONLY` até a auditoria do app passar |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_PUBLIC_URL` | sim | armazenamento das mídias (Cloudflare R2) |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | se usar avisos | notificações push |
| `CRON_SECRET` | sim | protege as rotas do agendador |
| **`VAULT_SECRET`** | se usar o Cofre | **chave que criptografa as senhas do Cofre — perdê-la é irreversível** |
| `ADMIN_EMAILS` | recomendada | e-mails de admin, separados por vírgula |
| `NEXT_PUBLIC_SITE_URL` | recomendada | endereço público (links de convite por e-mail) |

`NEXT_PUBLIC_BUILD_STAMP` e `VERCEL_URL` são preenchidas pela própria Vercel —
servem para o app instalado se atualizar sozinho.

---

## Banco de dados

Tudo roda no **Supabase**. No **SQL Editor**, aplique nesta ordem:

| Arquivo | O que faz |
|---|---|
| `supabase/schema.sql` | tabelas principais (contas, publicações, destinos, pauta…) |
| `supabase/migracao-colunas-faltantes.sql` | completa colunas/índices que faltavam — **seguro rodar sempre** |
| `supabase/token-health.sql` | avisos de token expirado |
| `supabase/central.sql` | Central de Atendimento (caixas de e-mail) |

> Ao criar tabela pelo painel, escolha **"Run and enable RLS"**. As tabelas são
> acessadas pelo servidor (service role, que ignora RLS); ligar RLS sem criar
> políticas bloqueia as chaves públicas — é o comportamento desejado, sobretudo
> em `central_mailboxes`, que guarda senhas de e-mail.

**Ao mexer no banco:** se adicionar uma coluna pelo painel, **acrescente também
ao SQL do repositório**. O projeto já teve 8 colunas existindo só em produção —
um banco novo montado pelo repositório simplesmente não publicava.

---

## Agendador (cron)

Duas rotas, ambas protegidas por `CRON_SECRET`:

| Rota | Frequência sugerida | O que faz |
|---|---|---|
| `/api/cron/publish?secret=…` | a cada 5 min | publica os posts agendados que venceram **e** puxa os e-mails da Central de carona |
| `/api/cron/cleanup?secret=…` | 1x por dia | apaga do storage as mídias já publicadas |

Chamadas por um serviço externo (a Vercel no plano atual não faz cron de
minutos). **Se esse serviço cair, os posts param de sair silenciosamente** —
vale configurar um alerta de "job falhou" no próprio serviço.

---

## Níveis de acesso

Definidos em `src/lib/access.ts`:

| Nível | Pode |
|---|---|
| **admin** | tudo: Equipe, Contas, Cofre, config da Central, publicar |
| **editor** | publicar/agendar, pauta, calendário, atender na Central |
| **viewer** | só visualizar; **pode** postar avisos no Mural |

Bloqueio real no servidor (`middleware.ts` + checagem em cada rota de API), não
só na interface. Admin definido por `ADMIN_EMAILS` é fixo: não dá para rebaixar
pela tela.

---

## Manutenção periódica

| Quando | O quê |
|---|---|
| Token da Meta cai (some sem aviso fixo) | *Contas* → **Reconectar** (renova todas de uma vez) |
| Meta descontinua versão da Graph API (~2 anos) | atualizar `META_GRAPH_VERSION` |
| TikTok | o token expira em ~24h e é renovado sozinho pelo `refresh_token` |
| Mensal | conferir se o agendador externo continua rodando |

---

## Deploy

Deploy automático na **Vercel**: todo `git push` na branch `master` publica em
produção (`studio.markseg.com.br`). As variáveis do `.env.local` estão no painel
da Vercel.

Antes de publicar uma mudança, rode localmente:

```bash
npx tsc --noEmit   # checagem de tipos
npm run build      # build de produção (é o que a Vercel faz)
```

## Trabalhar em outra máquina

```bash
git clone https://github.com/anunciomarkseg-hue/markseg-studio.git
cd markseg-studio
npm install
# criar o .env.local (ver acima)
npm run dev
```

Salvar mudanças: `git add -A && git commit -m "..." && git push`
Puxar mudanças: `git pull`
