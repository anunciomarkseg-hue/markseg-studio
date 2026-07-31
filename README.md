# MarkSeg Studio

Ferramenta interna da **MarkSeg** para gestão de redes sociais dos clientes:
publicação e agendamento (Instagram, Facebook, LinkedIn, TikTok), pauta
editorial com aprovação do cliente, mural interno, relatórios e insights.

**Stack:** Next.js 16 · React 19 · Tailwind v4 · Supabase (Postgres + Storage +
Auth) · Meta Graph API · Cloudflare R2 · Web Push (VAPID) · Deploy na Vercel.

## Rodar localmente

```bash
npm install
npm run dev
```

Antes precisa criar o arquivo **`.env.local`** na raiz (ele **não** vai pro Git,
por segurança). Copie os valores da máquina principal ou do gerenciador de
senhas. Chaves necessárias:

```
# Supabase
NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
# Meta (Instagram/Facebook)
META_APP_ID, META_APP_SECRET, META_REDIRECT_URI
# LinkedIn
LINKEDIN_CLIENT_ID, LINKEDIN_CLIENT_SECRET
# TikTok
TIKTOK_CLIENT_KEY, TIKTOK_CLIENT_SECRET, TIKTOK_DEFAULT_PRIVACY
# Cloudflare R2 (mídia)
R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, R2_PUBLIC_URL
# Web Push
VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT, NEXT_PUBLIC_VAPID_PUBLIC_KEY
# Agendador (cron)
CRON_SECRET
```

## Deploy

Deploy automático na **Vercel**: todo `git push` na branch `master` publica em
produção (`studio.markseg.com.br`). As mesmas variáveis do `.env.local` estão
configuradas no painel da Vercel.

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
