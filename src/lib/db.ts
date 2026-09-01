import { getSupabaseAdmin } from "./supabase";
import type { MediaType, PostStatus, ScheduledPost, SocialAccount } from "./types";
import { mascararSegredos } from "./segredos";

/**
 * Camada de acesso ao banco (server-only).
 * As telas e rotas /api usam estas funções em vez do mock.
 */

export async function listAccounts(): Promise<SocialAccount[]> {
  const sb = getSupabaseAdmin();
  const base = "id, platform, handle, name, followers, avatar, group_key";
  // tenta com as colunas de saúde do token; se ainda não existem (SQL não rodado),
  // cai no básico — nada quebra.
  const full = await sb
    .from("social_accounts")
    .select(`${base}, needs_reconnect, token_error`)
    .order("created_at", { ascending: true });
  if (!full.error) {
    // Mascara na LEITURA também: as linhas gravadas antes desta correção têm o
    // texto cru da rede, que pode conter o próprio token.
    return (full.data ?? []).map((a) => ({
      ...a,
      token_error: a.token_error ? mascararSegredos(a.token_error) : a.token_error,
    })) as unknown as SocialAccount[];
  }
  const basic = await sb.from("social_accounts").select(base).order("created_at", { ascending: true });
  if (basic.error) throw new Error(basic.error.message);
  return (basic.data ?? []) as unknown as SocialAccount[];
}

export async function listPosts(): Promise<ScheduledPost[]> {
  const sb = getSupabaseAdmin();
  const { data: posts, error } = await sb
    .from("scheduled_posts")
    .select("id, caption, media_type, media_urls, scheduled_for, status, collaborators, share_to_feed, created_by, created_at")
    .order("scheduled_for", { ascending: true });
  if (error) throw new Error(error.message);

  const ids = (posts ?? []).map((p) => p.id);
  const targetsByPost: Record<string, string[]> = {};
  const errorsByPost: Record<string, { accountId: string; error: string }[]> = {};
  if (ids.length) {
    const { data: targets, error: tErr } = await sb
      .from("post_targets")
      .select("post_id, account_id, status, error_message")
      .in("post_id", ids);
    if (tErr) throw new Error(tErr.message);
    for (const t of targets ?? []) {
      (targetsByPost[t.post_id] ??= []).push(t.account_id);
      // Só o erro do que NÃO saiu. Sem o filtro de status, um erro antigo de um
      // destino que depois publicou continuaria aparecendo como se o post
      // tivesse falhado.
      if (t.error_message && t.status !== "publicado") {
        (errorsByPost[t.post_id] ??= []).push({
          accountId: t.account_id,
          error: mascararSegredos(t.error_message),
        });
      }
    }
  }

  return (posts ?? []).map((p) => ({
    id: p.id,
    accountIds: targetsByPost[p.id] ?? [],
    caption: p.caption,
    mediaType: p.media_type as MediaType,
    media: p.media_urls && p.media_urls.length ? p.media_urls : ["gradient-blue"],
    scheduledFor: p.scheduled_for,
    status: p.status as PostStatus,
    collaborators: p.collaborators ?? [],
    shareToFeed: p.share_to_feed ?? false,
    createdBy: p.created_by ?? null,
    createdAt: p.created_at ?? null,
    targetErrors: errorsByPost[p.id] ?? [],
  }));
}

export interface CreatePostInput {
  caption: string;
  mediaType: MediaType;
  media: string[];
  scheduledFor: string; // ISO
  status: PostStatus;
  accountIds: string[];
  coverUrl?: string | null;
  collaborators?: string[] | null;
  shareToFeed?: boolean;
  createdBy?: string | null;
}

export async function createPost(input: CreatePostInput): Promise<string> {
  const sb = getSupabaseAdmin();

  // ── ANTI-DUPLICAÇÃO NA CRIAÇÃO ────────────────────────────────────────────
  // Se já existe um post com a MESMA mídia, pra alguma das MESMAS contas, no
  // MESMO horário (janela de 1h), NÃO cria outro — devolve o existente. Impede
  // que um duplo-envio (clicar "agendar" 2x) crie 2 posts do mesmo vídeo.
  const dedupeMedia = (input.media ?? []).filter((u) => typeof u === "string" && u.startsWith("http"));
  if (dedupeMedia.length && input.accountIds.length) {
    const base = Date.parse(input.scheduledFor);
    if (!Number.isNaN(base)) {
      const lo = new Date(base - 60 * 60 * 1000).toISOString();
      const hi = new Date(base + 60 * 60 * 1000).toISOString();
      const key = JSON.stringify(dedupeMedia);
      const { data: near } = await sb
        .from("scheduled_posts")
        .select("id, media_urls")
        .in("status", ["rascunho", "agendado", "aguardando", "publicado"])
        .gte("scheduled_for", lo)
        .lte("scheduled_for", hi);
      const sameMediaIds = (near ?? [])
        .filter((p) => {
          const m = (p.media_urls ?? []).filter((u: unknown) => typeof u === "string" && (u as string).startsWith("http"));
          return JSON.stringify(m) === key;
        })
        .map((p) => p.id);
      if (sameMediaIds.length) {
        const { data: sharedTargets } = await sb
          .from("post_targets")
          .select("post_id, account_id")
          .in("post_id", sameMediaIds)
          .in("account_id", input.accountIds);
        if (sharedTargets && sharedTargets.length) {
          return sharedTargets[0].post_id as string; // já existe: devolve em vez de duplicar
        }
      }
    }
  }
  // ──────────────────────────────────────────────────────────────────────────

  const { data, error } = await sb
    .from("scheduled_posts")
    .insert({
      caption: input.caption,
      media_type: input.mediaType,
      media_urls: input.media,
      cover_url: input.coverUrl ?? null,
      scheduled_for: input.scheduledFor,
      status: input.status,
      collaborators: input.collaborators?.length ? input.collaborators : null,
      share_to_feed: input.shareToFeed ?? false,
      created_by: input.createdBy ?? null,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  const postId = data.id as string;

  if (input.accountIds.length) {
    const rows = input.accountIds.map((account_id) => ({
      post_id: postId,
      account_id,
      status: input.status === "publicado" ? "publicado" : "agendado",
    }));
    const { error: tErr } = await sb.from("post_targets").insert(rows);
    if (tErr) throw new Error(tErr.message);
  }

  return postId;
}

export interface UpsertAccountInput {
  platform: "instagram" | "facebook" | "linkedin" | "tiktok";
  external_id: string;
  name: string;
  handle: string;
  followers: number;
  avatar: string;
  access_token: string;
  refresh_token?: string | null;
  token_expires_at?: string | null;
  group_key?: string | null;
}

/** Cria ou atualiza uma conta conectada (chave: platform + external_id). */
export async function upsertAccount(acc: UpsertAccountInput): Promise<void> {
  const sb = getSupabaseAdmin();
  const { data: existing } = await sb
    .from("social_accounts")
    .select("id")
    .eq("platform", acc.platform)
    .eq("external_id", acc.external_id)
    .maybeSingle();

  // reconectar zera o alerta de token expirado (se as colunas existirem)
  const withHealth = { ...acc, needs_reconnect: false, token_error: null };
  if (existing) {
    let { error } = await sb.from("social_accounts").update(withHealth).eq("id", existing.id);
    if (error) ({ error } = await sb.from("social_accounts").update(acc).eq("id", existing.id));
    if (error) throw new Error(error.message);
  } else {
    let { error } = await sb.from("social_accounts").insert(withHealth);
    if (error) ({ error } = await sb.from("social_accounts").insert(acc));
    if (error) throw new Error(error.message);
  }
}

/** Cria um link público de relatório (token) pra um cliente + período + rede. */
export async function createShare(groupKey: string, days: number, network: string): Promise<string> {
  const sb = getSupabaseAdmin();
  const token = crypto.randomUUID().replace(/-/g, "").slice(0, 16);
  const { error } = await sb.from("report_shares").insert({ token, group_key: groupKey, days, network });
  if (error) throw new Error(error.message);
  return token;
}

export async function getShare(token: string): Promise<{
  group_key: string | null;
  account_id: string | null;
  days: number;
  network: string;
} | null> {
  const sb = getSupabaseAdmin();
  const { data } = await sb
    .from("report_shares")
    .select("group_key, account_id, days, network")
    .eq("token", token)
    .maybeSingle();
  return data ?? null;
}
