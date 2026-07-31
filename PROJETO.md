# 📋 MarkSeg Studio — Estado do Projeto (retomar aqui)

> **Última atualização:** 22/06/2026
> **Pasta:** `C:\Users\gesto\RAFA\robos-meta`
> **Link no ar:** **https://robos-meta.vercel.app**

---

## 🎯 O que é este projeto

Uma **plataforma INTERNA da MarkSeg** (não é produto pra vender) pra gerenciar as redes sociais,
no estilo do **mLabs**, mas na nossa cara. A ideia são **dois "robôs" via Meta Graph API**:

1. **Robô 1 — Publicar & Agendar** posts no Instagram + Facebook (✅ interface pronta; falta funcionar de verdade)
2. **Robô 2 — Relatórios de orgânico** (Insights do IG/FB) → *ainda não começou (tela "em breve")*

A escolha foi **começar pelo Robô 1 (publicação)**.

---

## 🔗 Link e como republicar

- **Produção (fixo, mande no WhatsApp):** https://robos-meta.vercel.app
- Painel Vercel: https://vercel.com/markseg/robos-meta (conta `anunciomarkseg-5206` / scope `markseg`)
- **Pra atualizar o site depois de mexer no código:**
  ```bash
  cd C:\Users\gesto\RAFA\robos-meta
  vercel --prod --yes
  ```
  A mesma URL (`robos-meta.vercel.app`) atualiza sozinha — não muda o link.

> ⚠️ Hoje é **protótipo visual com dados de exemplo** (mock). O botão "Agendar" só mostra uma
> confirmação de demonstração. **Nada posta de verdade ainda.**

---

## 🎨 Identidade visual MarkSeg (já aplicada)

Extraída da logo oficial e do site `markseg.com.br`:

| Item | Valor |
|------|-------|
| Azul (primária) | degradê `#1c6fce` → `#154f97` |
| Laranja (acento/CTA) | degradê `#fba61c` → `#f26a2c` |
| Fundo | claro `#f4f7fb` / branco |
| Fontes | **Titillium Web** (títulos) + **Inter** (texto) |
| Logo/favicon | `public/brand/markseg-logo.png` e `markseg-favicon.png` |

🔧 Tudo centralizado em **`src/app/globals.css`** (Tailwind v4, bloco `@theme`). Pra trocar a marca
inteira, é só mexer ali.

---

## 🧱 Stack & contas

- **Next.js 16 + React 19 + Tailwind v4** (front + back juntos) · ícones `lucide-react`
- Deploy: **Vercel** (plano Hobby grátis) ✅ já configurado
- Banco: **Supabase** grátis — ✅ **conectado e funcionando** (projeto "Robo Markseg - posts e analise")
- Contas que o usuário já tem: **Vercel, GitHub, Meta Developer/Business, Supabase**
- Máquina: Node 20, git e Vercel CLI já instalados

---

## ✅ O que JÁ está pronto

Interface completa e navegável, no ar, responsiva (sidebar some no celular):

- [x] Base Next.js + tema da marca + fontes
- [x] **Visão geral** (`/`) — métricas, próximas publicações, contas
- [x] **Calendário** (`/calendario`) — mês navegável com posts nos dias
- [x] **Publicar** (`/publicar`) ⭐ — composer com **preview ao vivo** IG/FB, multi-conta, formato, data/hora
- [x] **Publicações** (`/publicacoes`) — lista com filtros por status
- [x] **Contas** (`/contas`) — perfis conectados + conectar nova
- [x] **Relatórios** (`/relatorios`) — teaser "em breve" do Robô 2
- [x] Copy de **uso interno** (sem cara de SaaS à venda)
- [x] Deploy na Vercel
- [x] **Supabase conectado** — tabelas `social_accounts`, `scheduled_posts`, `post_targets` + bucket `media`
- [x] **App lê/grava no banco de verdade** — telas leem do Supabase; o botão **Agendar/Rascunho** salva o post (rotas `/api/posts`, `/api/health`). Mídia ainda é placeholder (upload real vem depois).

---

## 🔲 O que FALTA (roadmap do back-end)

Ordem sugerida pra virar funcional de verdade:

- [x] **2. Supabase** — projeto + tabelas + `src/lib/supabase.ts` + `src/lib/db.ts` ✅ FEITO
- [x] **4a. Rotas de posts** — `/api/posts` (criar/listar) + app lendo/gravando no banco ✅ FEITO
- [ ] **3. Integração Meta** — `src/lib/meta.ts` (publicar IG via Content Publishing API; FB via Pages API)
- [ ] **5. OAuth da Meta** — `/api/meta/oauth` + `/api/meta/callback` (conectar contas reais e salvar token). **Precisa: criar App no Meta for Developers → App ID + App Secret.**
- [ ] **4b. Publicação real** — upload de mídia (Supabase Storage) + `/api/publish` + `/api/cron/publish` (publica agendados vencidos) + apagar mídia após publicar
- [ ] **7. Env (no Vercel), cron e README** — variáveis no painel da Vercel, agendamento e doc de setup

### Esboço técnico (pra implementar ao retomar)

**Tabelas Supabase:**
- `social_accounts`: id, platform (`instagram`|`facebook`), handle, name, external_id (IG user id / Page id), access_token, token_expires_at
- `scheduled_posts`: id, account_ids, caption, media_type, media_urls, scheduled_for, status, external_post_id, error_message

**Variáveis de ambiente (`.env.local` + Vercel):**
```
META_APP_ID=
META_APP_SECRET=
META_REDIRECT_URI=https://robos-meta.vercel.app/api/meta/callback
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
CRON_SECRET=            # protege a rota /api/cron/publish
```

**Publicação (Meta):**
- Instagram: cria container (`POST /{ig-user-id}/media`) → publica (`POST /{ig-user-id}/media_publish`). **Não tem agendamento nativo** → nosso cron publica na hora certa. Limite ~25 posts/24h.
- Facebook Page: tem agendamento nativo (`scheduled_publish_time` + `published=false`).

**Agendamento (cron):** Vercel Hobby limita cron (≈1x/dia). Pra publicar em horário exato, usar
**gatilho externo** (cron-job.org) ou **Upstash QStash** (grátis) chamando `/api/cron/publish`.

---

## ⚠️ Requisitos "chatos" da Meta (não é código)

- App no **Meta for Developers** + **App Review** (verificação de negócio + revisão das permissões
  `instagram_content_publish`, `pages_manage_posts`) pra postar em contas reais.
- Em **modo de desenvolvimento** funciona nas **suas próprias contas** conectadas — ótimo pra testar/demonstrar.
- Conta IG precisa ser **Profissional** e estar **vinculada a uma Página do Facebook**.

---

## 💻 Como rodar localmente

```bash
cd C:\Users\gesto\RAFA\robos-meta
npm install        # se for em outra máquina
npm run dev        # abre em http://localhost:3000
```

Build de produção (pra testar antes de subir): `npm run build`

---

## 🗂️ Estrutura principal

```
robos-meta/
├─ src/app/
│  ├─ globals.css          # 🎨 tema da marca (cores, fontes)
│  ├─ layout.tsx           # shell: sidebar + topbar + fontes
│  ├─ page.tsx             # Visão geral (dashboard)
│  ├─ publicar/page.tsx    # ⭐ composer com preview ao vivo
│  ├─ calendario/page.tsx
│  ├─ publicacoes/page.tsx
│  ├─ contas/page.tsx
│  └─ relatorios/page.tsx  # teaser Robô 2
│  └─ api/                 # health/route.ts, posts/route.ts (criar/listar)
├─ src/components/         # Sidebar, Topbar, PhonePreview, PostListItem, Composer, etc.
├─ src/lib/                # types.ts, format.ts, supabase.ts (cliente), db.ts (queries)
├─ supabase/schema.sql     # rodar no SQL Editor do Supabase
└─ public/brand/           # logo + favicon da MarkSeg

(obs.: src/lib/mock.ts ainda existe mas NÃO é mais usado — dados vêm do banco.)
```

---

## 🧠 Decisões e armadilhas (pra não tropeçar depois)

- **Dados vêm do Supabase** via `src/lib/db.ts` (`listAccounts`, `listPosts`, `createPost`). As telas que leem o banco são server components com `export const dynamic = "force-dynamic"`. Componentes interativos (Composer, Calendar, Publicações) são client e recebem os dados por props.
- **A `service_role`/secret key só pode ser usada no servidor** (`src/lib/supabase.ts` → `getSupabaseAdmin()`). Nunca importar em componente `"use client"`.
- **Mídia ainda é placeholder** (degradê escolhido no composer, salvo em `media_urls`). Upload real + apagar-após-publicar entram na fase de publicação.
- **Tailwind v4**: NÃO existe `tailwind.config.js`; o tema fica no `@theme` dentro do `globals.css`.
- **Next 16**: `params`/`searchParams` em páginas são `Promise` (precisa `await`).
- O projeto tem um `AGENTS.md` dizendo pra ler `node_modules/next/dist/docs/` — **essa pasta não existe**;
  seguir os padrões normais do Next 16.
- Aviso de "multiple lockfiles" no build é por causa de um `package-lock.json` na pasta pai
  (`C:\Users\gesto`); **não afeta a Vercel** (só sobe a pasta do projeto). Inofensivo.

---

## ▶️ Próximo passo recomendado ao retomar

**Integração com a Meta (publicação real).** Pré-requisito (o usuário faz):
1. Criar um App no **Meta for Developers** (developers.facebook.com) → tipo "Business".
2. Adicionar produtos **Instagram** + **Facebook Login**.
3. Pegar **App ID** + **App Secret** → colocar no `.env.local` (`META_APP_ID`, `META_APP_SECRET`).
4. Conectar conta IG Profissional a uma Página do FB.

Depois (eu faço): OAuth (`/api/meta/oauth` + `/callback`) pra conectar contas reais e salvar token →
`src/lib/meta.ts` (publicar) → upload de mídia no Storage → `/api/cron/publish`.

> Resumo de uma linha: **interface no ar + Supabase conectado (lê/grava de verdade); falta a Meta API pra publicar nas redes.**
