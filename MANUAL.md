# Manual do MarkSeg Studio — guia completo de quem assume o projeto

> Este documento é a **entrega oficial** do projeto. Ele explica o que o sistema
> é, como conseguir acesso a tudo, como rodar, como consertar e como melhorar.
>
> **Se você está lendo isto dentro do Claude (ou outra IA):** este arquivo é o
> contexto do projeto. Leia-o inteiro antes de sugerir qualquer mudança, e siga
> as regras da seção "Regras de ouro".

---

## 1. O que é o MarkSeg Studio

Ferramenta interna da agência **MarkSeg** para cuidar das redes sociais dos
clientes. Substitui a rotina de abrir o app de cada cliente na mão.

**O que ele faz:**

| Área | O que resolve |
|---|---|
| **Publicar / Agendar** | posta em Instagram, Facebook, LinkedIn e TikTok — na hora ou agendado para qualquer data |
| **Pauta editorial** | planeja o mês, e o **cliente aprova por um link público** (sem login) |
| **Calendário** | visão do mês por cliente |
| **Publicações** | histórico do que saiu, falhou ou está agendado |
| **Analytics** | relatórios de desempenho (alcance, engajamento, seguidores) |
| **Mural / Conversas** | recados e bate-papo interno do time |
| **Cofre** | senhas e credenciais dos clientes, criptografadas |
| **Central de Atendimento** | e-mails de várias contas num painel só |
| **Equipe** | convida pessoas por e-mail e define o nível de acesso |

**Quem usa:** a equipe da agência. Os clientes só tocam nos **links públicos**
de aprovação de pauta e de relatório.

---

## 2. Tecnologias (o que você precisa conhecer)

| Peça | Para que serve |
|---|---|
| **Next.js 16** (App Router) + **React 19** | o site inteiro (telas e APIs no mesmo projeto) |
| **TypeScript** | tipagem — é o que evita metade dos erros |
| **Tailwind v4** | estilo/visual |
| **Supabase** | banco de dados (Postgres), login dos usuários e armazenamento |
| **Vercel** | hospedagem; publica sozinho a cada `git push` |
| **Meta Graph API** | Instagram e Facebook |
| **Cloudflare R2** | onde as mídias (fotos/vídeos) ficam guardadas |
| **Web Push (VAPID)** | notificações no celular |

Não precisa dominar tudo. Para o dia a dia bastam **TypeScript + React**, e
saber ler o que já existe.

---

## 3. Acessos — o que pedir e como conectar

Você precisa de **6 acessos**. Peça todos ao dono antes de começar.

### 3.1 GitHub (o código)

1. Peça para ser adicionado como **colaborador** no repositório
   `anunciomarkseg-hue/markseg-studio`.
2. Aceite o convite (chega por e-mail).
3. No seu computador:

```bash
git clone https://github.com/anunciomarkseg-hue/markseg-studio.git
cd markseg-studio
npm install
```

> Se pedir senha ao dar `git push`, gere um **token** em GitHub → Settings →
> Developer settings → Personal access tokens, e use no lugar da senha.

### 3.2 Vercel (a hospedagem)

1. Peça para ser convidado ao **time/projeto** na Vercel.
2. Lá você encontra:
   - **Deployments** — histórico de publicações e os erros de build
   - **Settings → Environment Variables** — todas as chaves do sistema
   - **Logs** — o que aconteceu em produção (essencial para diagnosticar)
3. **Copie as variáveis** para o seu `.env.local` (seção 4).

> Algumas variáveis aparecem como **Sensitive** e não podem ser copiadas pela
> tela. Peça o valor ao dono / gerenciador de senhas da agência.

### 3.3 Supabase (banco de dados e login)

1. Peça acesso ao projeto no [supabase.com](https://supabase.com).
2. O que você vai usar:
   - **Table Editor** — ver e editar dados
   - **SQL Editor** — rodar as migrações (seção 5)
   - **Authentication → Users** — quem tem login
   - **Authentication → URL Configuration** — endereços permitidos nos convites
3. As chaves ficam em **Settings → API**:
   - `anon key` → pública, vai para o navegador
   - `service_role key` → **poder total no banco; nunca exponha**

### 3.4 Meta / Facebook Developers (Instagram e Facebook)

1. Peça para ser adicionado como **administrador** do app em
   [developers.facebook.com](https://developers.facebook.com).
2. Confira em **Configurações → Básico**: `META_APP_ID` e `META_APP_SECRET`.
3. Em **Login do Facebook → Configurações**, a URL de redirecionamento precisa
   incluir `https://studio.markseg.com.br/api/meta/callback`.

### 3.5 Cloudflare R2 (as mídias)

1. Peça acesso à conta Cloudflare.
2. Em **R2**, veja o bucket usado e as chaves de API.
3. É aqui que ficam as fotos e vídeos enviados antes de irem para as redes.

### 3.6 Domínio (studio.markseg.com.br)

Peça ao dono onde o domínio está registrado e quem consegue mexer no DNS. Você
só precisa disso se o endereço mudar.

> ✅ **Checklist de acesso:** GitHub · Vercel · Supabase · Meta · Cloudflare ·
> Domínio. Sem os 6, você fica travado em algum momento.

---

## 4. Rodar na sua máquina

Precisa do **Node.js 20 ou mais novo**.

```bash
npm install
npm run dev     # abre em http://localhost:3000
```

Antes, crie o arquivo **`.env.local`** na raiz (ele nunca vai para o Git).
Copie os valores da Vercel:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=

# Meta (Instagram / Facebook)
META_APP_ID=
META_APP_SECRET=
META_GRAPH_VERSION=v21.0

# LinkedIn (opcional)
LINKEDIN_CLIENT_ID=
LINKEDIN_CLIENT_SECRET=
LINKEDIN_API_VERSION=202405

# TikTok (opcional)
TIKTOK_CLIENT_KEY=
TIKTOK_CLIENT_SECRET=
TIKTOK_DEFAULT_PRIVACY=SELF_ONLY

# Cloudflare R2 (mídias)
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET=
R2_PUBLIC_URL=

# Notificações
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=
NEXT_PUBLIC_VAPID_PUBLIC_KEY=

# Agendador e administração
CRON_SECRET=
ADMIN_EMAILS=email1@dominio.com,email2@dominio.com
NEXT_PUBLIC_SITE_URL=https://studio.markseg.com.br

# Cofre de senhas — ⚠️ ver aviso na seção 9
VAULT_SECRET=
```

---

## 5. Banco de dados — ordem de instalação

No Supabase → **SQL Editor**, rode nesta ordem:

| # | Arquivo | O que faz |
|---|---|---|
| 1 | `supabase/schema.sql` | tabelas principais |
| 2 | `supabase/migracao-colunas-faltantes.sql` | completa colunas e índices — **seguro rodar sempre** |
| 3 | `supabase/token-health.sql` | aviso de token expirado |
| 4 | `supabase/central.sql` | Central de Atendimento |

Ao criar tabelas, escolha **"Run and enable RLS"**. O sistema acessa o banco
pelo servidor (que ignora RLS); ligar RLS sem políticas bloqueia as chaves
públicas — é exatamente o que se quer, principalmente em `central_mailboxes`,
que guarda senhas de e-mail.

> ⚠️ **Regra:** se você criar uma coluna pelo painel do Supabase, **acrescente
> também ao arquivo SQL do repositório**. O projeto já teve 8 colunas existindo
> só em produção — um banco novo montado pelo repositório não publicava nada.

---

## 6. Como o projeto é organizado

```
src/
├── app/                    → páginas e APIs (cada pasta = um endereço)
│   ├── page.tsx            → Visão geral
│   ├── publicar/           → criar publicação
│   ├── pauta/              → pauta editorial
│   ├── calendario/         → calendário
│   ├── publicacoes/        → histórico
│   ├── relatorios/         → analytics
│   ├── central/            → Central de Atendimento
│   ├── cofre/              → senhas dos clientes
│   ├── equipe/             → convidar pessoas
│   ├── contas/             → conectar redes sociais
│   ├── aprovar/[token]/    → link PÚBLICO do cliente aprovar pauta
│   ├── r/[token]/          → link PÚBLICO de relatório
│   └── api/                → todas as rotas de servidor
├── components/             → peças de tela (React)
├── lib/                    → a lógica de verdade
│   ├── publish.ts          → ⭐ o coração: publica nas redes
│   ├── meta.ts             → Instagram e Facebook
│   ├── db.ts               → acesso ao banco
│   ├── access.ts           → níveis de acesso
│   └── central/            → módulo de e-mails
└── middleware.ts           → porteiro: quem entra em cada página
```

**Regra mental:** `app/` é a casca (telas e endereços), `lib/` é onde as
decisões acontecem. Ao consertar um comportamento, o conserto quase sempre é em
`lib/`.

---

## 7. Como o sistema funciona (fluxos principais)

### Publicar

```
Você monta o post em /publicar
   ↓ a mídia sobe direto para o Cloudflare R2 (não passa pelo servidor)
   ↓ o post é gravado no banco com status "agendado"
   ↓ /api/posts/[id]/publish chama a rede social
   ↓ cada conta de destino vira uma linha em post_targets
   ↓ deu certo → guarda o id do post na rede; falhou → guarda o erro
```

**Por que às vezes demora:** Reel/vídeo precisa ser processado pelo Instagram.
O sistema espera um pouco e, se passar do tempo da função, encerra com
elegância e o **agendador conclui depois**. O app então **consulta o estado
real** e mostra o que de fato aconteceu (nunca mais "erro falso").

### Agendar

Os posts com hora marcada ficam no banco. Um **serviço externo** chama
`/api/cron/publish?secret=…` de tempos em tempos e publica o que venceu.

> ⚠️ **Se esse serviço parar, nada é publicado e ninguém é avisado.** Confira
> uma vez por mês. Veja a seção 9.

### Aprovação do cliente

Você gera um link em **Pauta**. O cliente abre **sem login**, aprova ou pede
ajuste. O retorno aparece com um contador vermelho no menu para os admins.

---

## 8. Níveis de acesso

Definidos em `src/lib/access.ts`:

| Nível | Pode fazer |
|---|---|
| **admin** | tudo: Equipe, Contas, Cofre, configurar a Central, publicar |
| **editor** | publicar/agendar, pauta, calendário, atender na Central |
| **viewer** | só visualiza; **pode** postar avisos no Mural |

O bloqueio é **real no servidor** (`middleware.ts` + checagem em cada rota),
não só na tela. Quem está em `ADMIN_EMAILS` é admin fixo e não pode ser
rebaixado pela interface.

> 🔒 **Nunca** guarde o nível de acesso em `user_metadata` do Supabase: o
> próprio usuário consegue reescrever esse campo pelo navegador e virar admin.
> O sistema usa `app_metadata`, que só o servidor altera. Isso já foi uma falha
> real aqui — não reintroduza.

---

## 9. Manutenção — o que exige atenção periódica

| Sinal | O que fazer | Frequência |
|---|---|---|
| Contas com selo vermelho **"Reconecte"** | *Contas* → **Reconectar** (renova todas de uma vez) | quando aparecer |
| Posts agendados pararam de sair | conferir se o serviço de agendamento externo está rodando | mensal |
| Meta descontinua a versão da API | atualizar `META_GRAPH_VERSION` | ~a cada 2 anos |
| LinkedIn parou de publicar | atualizar `LINKEDIN_API_VERSION` (validade ~1 ano) | anual |
| Armazenamento crescendo | `/api/cron/cleanup` apaga mídia já publicada | automático |

### ⚠️ Os três avisos mais importantes

1. **`VAULT_SECRET` é a chave do Cofre.** Ela descriptografa as senhas
   guardadas. **Se for trocada ou perdida, todo o Cofre fica ilegível para
   sempre — não há recuperação.** Guarde uma cópia fora da Vercel.
2. **O agendador é externo à Vercel.** Um serviço de fora chama
   `/api/cron/publish?secret=<CRON_SECRET>`. Descubra com o dono **qual serviço
   é e quem tem a conta** — sem isso você não consegue consertar quando parar.
3. **Os tokens da Meta caem sozinhos** (troca de senha do Facebook ou decisão de
   segurança deles). Não é bug: é reconectar em *Contas*.

---

## 10. Consertar problemas (guia prático)

### "O post não saiu"

1. Abra **Publicações** e veja o status.
2. Está **"Falhou"**? A mensagem de erro diz o motivo. Os mais comuns:
   - *token inválido/expirado* → *Contas* → **Reconectar**
   - *vídeo rejeitado* → o Instagram exige MP4/H.264, vertical 9:16, 3s–15min
   - *"nível de acesso não permite"* → a pessoa é **viewer**
3. Corrigido o motivo, clique em **Republicar** — ele reenvia **só o que não
   saiu** e não duplica o que já foi publicado.

### "Preciso adiar (ou antecipar) um post agendado"

1. Abra **Publicações** e ache o post.
2. Clique em **Reagendar**, escolha a nova data e hora e salve.
3. Vale só enquanto o post **não saiu**: publicado não muda de data, e post em
   pleno envio é recusado até terminar. Post que **falhou** volta pra fila e
   sai na data nova (o que já publicou não duplica).

Por baixo: `PATCH /api/posts/<id>` com `{ "scheduledFor": "<ISO>" }`.

### "Aparece um erro estranho na tela"

Vá em **Vercel → Logs**, filtre pelo horário e procure a rota (`/api/...`). O
erro real aparece lá com a linha do código.

### "A tela está lenta"

Quase sempre é consulta ao banco trazendo demais. Procure em `src/lib/` a
função que a tela usa e verifique: tem `.limit()`? traz colunas que não usa? faz
consulta dentro de laço? Veja também a seção 11.

### "Erro de build ao publicar na Vercel"

Rode antes de subir:

```bash
npx tsc --noEmit    # erros de tipo
npm run build       # o mesmo que a Vercel faz
```

Se passar aqui, passa lá.

### "Alguém não consegue entrar"

- Convite não chega → veja **Authentication → Users** no Supabase; reenvie por
  *Equipe*.
- Link do convite falha → confira **Authentication → URL Configuration**
  (Site URL e Redirect URLs precisam bater com o domínio).

---

## 11. Como otimizar (sem quebrar)

Antes de otimizar, **meça**: Vercel → Logs mostra a duração de cada rota. Ataque
o que está lento de verdade, não o que "parece" lento.

**Padrões que já causaram lentidão aqui** (e o conserto):

| Problema | Conserto |
|---|---|
| Trazer a lista inteira só para contar | pedir a **contagem** ao banco (`count: "exact", head: true`) |
| Consulta dentro de laço (N+1) | uma consulta com `.in(...)` fora do laço |
| `SELECT` sem limite em tabela que cresce | sempre `.limit()` + paginação |
| Chamada externa sem prazo | **sempre** `AbortSignal.timeout(...)` — sem isso a tela pendura |
| Trabalho pesado no `layout.tsx` | ele roda em **toda** navegação; tire de lá |
| Buscar em série o que é independente | `Promise.all` |

**Limite de tempo:** cada rota tem no máximo ~60s na Vercel. Operações longas
(vídeo, muitas contas) precisam de **orçamento de tempo**: fazer o que dá,
encerrar com elegância e deixar o agendador terminar. É assim que `publish.ts`
funciona — siga o mesmo padrão.

---

## 12. Fazer mudanças com segurança

```bash
git pull                        # pega o que há de novo
git checkout -b minha-mudanca   # trabalhe numa branch
# ... edite ...
npx tsc --noEmit && npm run build   # confira ANTES de subir
git add -A && git commit -m "descreva o que mudou"
git push -u origin minha-mudanca
```

Na Vercel, a branch ganha um **endereço de teste** — abra e valide ali. Só
depois junte na `master` (que publica em produção automaticamente).

### Regras de ouro

1. **Nunca** exponha `SUPABASE_SERVICE_ROLE_KEY` ou qualquer segredo em arquivo
   com `"use client"`.
2. **Nunca** guarde permissão em `user_metadata` (seção 8).
3. **Sempre** coloque prazo (`AbortSignal.timeout`) em chamada externa.
4. **Sempre** confirme permissão **no servidor**, não só escondendo o botão. E
   em caso de dúvida, **recuse** (falhe fechado).
5. Mexeu no banco? **Atualize o SQL do repositório** também.
6. Rode `npx tsc --noEmit && npm run build` antes de todo push.
7. Teste publicação numa **conta de teste** antes de mexer em `publish.ts` — ali
   um erro vai para o perfil real do cliente.

---

## 13. Limitações conhecidas (não são bugs)

- **Instagram e TikTok não permitem apagar post pela API.** O sistema apaga o
  registro interno e avisa que a remoção precisa ser feita pelo app.
- **O TikTok publica como privado** (`SELF_ONLY`) até a auditoria do app ser
  aprovada pelo TikTok.
- **A Meta limita ~25 publicações por conta a cada 24h.**
- **A Vercel no plano atual não agenda de minuto em minuto** — daí o serviço
  externo.

---

## 14. Onde pedir ajuda

1. **Vercel → Logs** — o erro real de produção.
2. **Supabase → Table Editor** — o estado real dos dados.
3. **Comentários no código** — as partes delicadas (`publish.ts`, `meta.ts`,
   `access.ts`) estão comentadas explicando o *porquê*, não só o *o quê*.
4. **`README.md`** — resumo rápido de instalação e variáveis.

---

## 15. O que perguntar ao dono antes que ele saia

Coisas que **não estão no código** e só ele sabe:

- [ ] Qual serviço dispara o agendador e **quem tem a conta**?
- [ ] Onde está guardada a cópia de segurança da **`VAULT_SECRET`**?
- [ ] Quem é o dono das contas: Vercel, Supabase, Cloudflare, Meta, domínio?
- [ ] Existe backup do banco? Com que frequência?
- [ ] Quais clientes usam quais redes (e quais estão em teste)?
- [ ] Há combinados com clientes sobre horário de publicação?
- [ ] Quem deve ficar como **admin** depois da transição (`ADMIN_EMAILS`)?

> Preencha este checklist **antes** do desligamento. É o item que mais trava
> uma transição.
