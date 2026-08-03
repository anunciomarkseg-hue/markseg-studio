/**
 * Integração com a Meta Graph API (Facebook Login + Páginas + Instagram).
 * Server-only. Usa META_APP_ID / META_APP_SECRET do .env.local.
 */

const GRAPH_VERSION = process.env.META_GRAPH_VERSION ?? "v21.0";
const GRAPH = `https://graph.facebook.com/${GRAPH_VERSION}`;
const APP_ID = process.env.META_APP_ID ?? "";
const APP_SECRET = process.env.META_APP_SECRET ?? "";

export const metaConfigured = Boolean(APP_ID && APP_SECRET);

/** Permissões que o app pede no login. Em modo dev valem nas suas próprias contas.
 *  pages_manage_posts (postar na Página do FB) será adicionado depois — por ora
 *  o foco é publicar no Instagram, que não precisa dela. */
export const META_SCOPES = [
  "pages_show_list",
  "pages_read_engagement",
  "pages_manage_posts",
  "read_insights",
  "instagram_basic",
  "instagram_content_publish",
  "instagram_manage_insights",
  "business_management",
].join(",");

export function getLoginUrl(redirectUri: string, state: string): string {
  const p = new URLSearchParams({
    client_id: APP_ID,
    redirect_uri: redirectUri,
    state,
    scope: META_SCOPES,
    response_type: "code",
    // força o Facebook a re-perguntar TODAS as permissões (mesmo já autorizado)
    auth_type: "rerequest",
  });
  return `https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth?${p.toString()}`;
}

async function graphGet<T>(url: string): Promise<T> {
  const res = await fetch(url, { signal: AbortSignal.timeout(25000) });
  const json = (await res.json()) as T & { error?: { message?: string } };
  if (json && (json as { error?: { message?: string } }).error) {
    throw new Error((json as { error?: { message?: string } }).error?.message ?? "Erro na API da Meta");
  }
  return json;
}

async function graphPost(
  path: string,
  params: Record<string, string>,
): Promise<{ id?: string; post_id?: string }> {
  const res = await fetch(`${GRAPH}/${path}`, {
    method: "POST",
    body: new URLSearchParams(params),
    signal: AbortSignal.timeout(25000),
  });
  const json = (await res.json()) as { id?: string; post_id?: string; error?: { message?: string } };
  if (json.error) throw new Error(json.error.message ?? "Erro ao publicar na Meta");
  return json;
}

export async function exchangeCodeForToken(code: string, redirectUri: string): Promise<string> {
  const p = new URLSearchParams({
    client_id: APP_ID,
    client_secret: APP_SECRET,
    redirect_uri: redirectUri,
    code,
  });
  const json = await graphGet<{ access_token: string }>(`${GRAPH}/oauth/access_token?${p.toString()}`);
  return json.access_token;
}

export async function getLongLivedToken(shortToken: string): Promise<string> {
  const p = new URLSearchParams({
    grant_type: "fb_exchange_token",
    client_id: APP_ID,
    client_secret: APP_SECRET,
    fb_exchange_token: shortToken,
  });
  const json = await graphGet<{ access_token: string }>(`${GRAPH}/oauth/access_token?${p.toString()}`);
  return json.access_token;
}

export interface MetaPage {
  id: string;
  name: string;
  access_token: string;
  instagram?: { id: string; username: string; followers: number };
}

interface RawPage {
  id: string;
  name: string;
  access_token: string;
  instagram_business_account?: { id: string; username: string; followers_count?: number };
}

/** Lista as Páginas que o usuário administra + a conta de Instagram vinculada a cada uma. */
export async function getPages(userToken: string): Promise<MetaPage[]> {
  const fields = "id,name,access_token,instagram_business_account{id,username,followers_count}";
  const json = await graphGet<{ data?: RawPage[] }>(
    `${GRAPH}/me/accounts?fields=${encodeURIComponent(fields)}&limit=100&access_token=${userToken}`,
  );
  return (json.data ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    access_token: p.access_token,
    instagram: p.instagram_business_account
      ? {
          id: p.instagram_business_account.id,
          username: p.instagram_business_account.username,
          followers: p.instagram_business_account.followers_count ?? 0,
        }
      : undefined,
  }));
}

/** Publica uma imagem no Instagram (cria container + publica). Retorna o id do post. */
export async function publishToInstagram(
  igUserId: string,
  pageToken: string,
  opts: { imageUrl: string; caption: string; collaborators?: string[] },
): Promise<string> {
  const params: Record<string, string> = {
    image_url: opts.imageUrl,
    caption: opts.caption,
    access_token: pageToken,
  };
  if (opts.collaborators?.length) params.collaborators = JSON.stringify(opts.collaborators);
  const container = await graphPost(`${igUserId}/media`, params);
  if (!container.id) throw new Error("Falha ao criar a mídia no Instagram");

  // ESPERA o container ficar PRONTO antes de publicar. Publicar cedo demais faz
  // a Meta responder "Media ID is not available" — foi o que derrubou os posts
  // de imagem da NICE no Instagram (o Reel/carrossel já esperavam; a imagem não).
  const start = Date.now();
  let status = await getContainerStatus(container.id, pageToken);
  while (status !== "FINISHED" && Date.now() - start < 30000) {
    if (status === "ERROR" || status === "EXPIRED") {
      throw new Error("O Instagram rejeitou a imagem (confira proporção/qualidade e tente de novo).");
    }
    await sleep(2500);
    status = await getContainerStatus(container.id, pageToken);
  }
  if (status !== "FINISHED") {
    throw new Error("A imagem ainda estava processando no Instagram — tente publicar de novo em instantes.");
  }

  // media_publish com retry pro erro transitório "Media ID is not available".
  let published: { id?: string } = {};
  for (let i = 0; i < 3; i++) {
    try {
      published = await graphPost(`${igUserId}/media_publish`, {
        creation_id: container.id,
        access_token: pageToken,
      });
      if (published.id) break;
    } catch (e) {
      const msg = (e as Error).message || "";
      if (i === 2 || !/not available|media id|媒体/i.test(msg)) throw e;
      await sleep(3000);
    }
  }
  if (!published.id) throw new Error("Falha ao publicar no Instagram");
  return published.id;
}

/** Publica na Página do Facebook (foto com legenda, ou texto). Retorna o id do post. */
export async function publishToFacebookPage(
  pageId: string,
  pageToken: string,
  opts: { message: string; mediaUrl?: string; isVideo?: boolean },
): Promise<string> {
  // Vídeo (a Meta às vezes dá "Invalid parameter" transitório ao buscar o vídeo → tenta de novo)
  if (opts.mediaUrl && opts.isVideo) {
    let lastErr: unknown;
    for (let i = 0; i < 3; i++) {
      try {
        const r = await graphPost(`${pageId}/videos`, {
          file_url: opts.mediaUrl,
          description: opts.message,
          access_token: pageToken,
        });
        return (r.id ?? r.post_id) as string;
      } catch (e) {
        lastErr = e;
        await sleep(2500);
      }
    }
    throw lastErr instanceof Error ? lastErr : new Error("Falha ao publicar vídeo no Facebook");
  }
  // Foto
  if (opts.mediaUrl) {
    const r = await graphPost(`${pageId}/photos`, {
      url: opts.mediaUrl,
      caption: opts.message,
      access_token: pageToken,
    });
    return (r.post_id ?? r.id) as string;
  }
  // Só texto
  const r = await graphPost(`${pageId}/feed`, {
    message: opts.message,
    access_token: pageToken,
  });
  return r.id as string;
}

/** Apaga um post/foto/vídeo da Página do Facebook. (IG não permite apagar via API.) */
export async function deleteFacebookPost(externalPostId: string, pageToken: string): Promise<void> {
  const res = await fetch(
    `https://graph.facebook.com/${GRAPH_VERSION}/${externalPostId}?access_token=${encodeURIComponent(pageToken)}`,
    { method: "DELETE" },
  );
  const json = (await res.json().catch(() => ({}))) as {
    success?: boolean;
    error?: { message?: string };
  };
  if (!res.ok || json.error) {
    throw new Error(json.error?.message || `Facebook recusou apagar (HTTP ${res.status})`);
  }
}

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Cria o container de Reel (vídeo). Retorna o id do container (processa async). */
export async function createReelContainer(
  igUserId: string,
  pageToken: string,
  opts: {
    videoUrl: string;
    caption: string;
    coverUrl?: string;
    collaborators?: string[];
    /** false = o Reel fica só na aba Reels (NÃO aparece no feed). */
    shareToFeed?: boolean;
  },
): Promise<string> {
  const params: Record<string, string> = {
    media_type: "REELS",
    video_url: opts.videoUrl,
    caption: opts.caption,
    share_to_feed: opts.shareToFeed ? "true" : "false",
    access_token: pageToken,
  };
  if (opts.coverUrl) params.cover_url = opts.coverUrl;
  if (opts.collaborators?.length) params.collaborators = JSON.stringify(opts.collaborators);

  const container = await graphPost(`${igUserId}/media`, params);
  if (!container.id) throw new Error("Falha ao criar o Reel no Instagram");
  return container.id;
}

/** Status do container do Instagram: IN_PROGRESS | FINISHED | ERROR | EXPIRED. */
export async function getContainerStatus(containerId: string, pageToken: string): Promise<string> {
  const st = await graphGet<{ status_code?: string }>(
    `${GRAPH}/${containerId}?fields=status_code&access_token=${pageToken}`,
  );
  return st.status_code ?? "";
}

/** Publica um container que já está FINISHED. Retorna o id do post. */
export async function publishContainer(
  igUserId: string,
  pageToken: string,
  containerId: string,
): Promise<string> {
  const published = await graphPost(`${igUserId}/media_publish`, {
    creation_id: containerId,
    access_token: pageToken,
  });
  if (!published.id) throw new Error("Falha ao publicar o Reel");
  return published.id;
}

/** Espera um container do Instagram ficar FINISHED (senão o publish dá "Media ID is not available"). */
async function waitContainerFinished(
  containerId: string,
  pageToken: string,
  label: string,
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < 60000) {
    const status = await getContainerStatus(containerId, pageToken);
    if (status === "FINISHED") return;
    if (status === "ERROR" || status === "EXPIRED") {
      throw new Error(`O Instagram rejeitou ${label} (imagem inválida ou inacessível).`);
    }
    await sleep(3000);
  }
  throw new Error(`Tempo esgotado processando ${label} no Instagram — tente publicar de novo.`);
}

/** Erros TRANSITÓRIOS da Meta (some numa nova tentativa) — ex.: "Timeout" ao baixar a imagem. */
function isTransientMetaError(msg: string): boolean {
  return /timeout|temporar|try again|unknown error|reduce the amount|aborted|rate limit|please retry/i.test(msg);
}

/** Cria 1 container "filho" do carrossel, com retry pros erros transitórios da Meta. */
async function createCarouselChild(igUserId: string, pageToken: string, imageUrl: string): Promise<string> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const child = await graphPost(`${igUserId}/media`, {
        image_url: imageUrl,
        is_carousel_item: "true",
        access_token: pageToken,
      });
      if (!child.id) throw new Error("Falha ao subir uma imagem do carrossel no Instagram");
      return child.id;
    } catch (e) {
      lastErr = e;
      if (isTransientMetaError((e as Error).message || "") && attempt < 3) {
        await sleep(2500 * attempt);
        continue;
      }
      throw e;
    }
  }
  throw lastErr as Error;
}

/** Publica um CARROSSEL no Instagram (2 a 10 imagens). Filhos em PARALELO + espera só o pai. */
export async function publishCarouselToInstagram(
  igUserId: string,
  pageToken: string,
  opts: { imageUrls: string[]; caption: string; collaborators?: string[] },
): Promise<string> {
  const urls = opts.imageUrls.slice(0, 10);
  // 1) cria TODOS os containers "filhos" em paralelo (rápido; não estoura o tempo da função)
  const childIds = await Promise.all(urls.map((u) => createCarouselChild(igUserId, pageToken, u)));
  // 2) espera todos ficarem prontos, também em paralelo
  await Promise.all(childIds.map((id) => waitContainerFinished(id, pageToken, "uma imagem do carrossel")));
  // 3) container "pai" do carrossel + espera processar
  const parentParams: Record<string, string> = {
    media_type: "CAROUSEL",
    children: childIds.join(","),
    caption: opts.caption,
    access_token: pageToken,
  };
  if (opts.collaborators?.length) parentParams.collaborators = JSON.stringify(opts.collaborators);
  const parent = await graphPost(`${igUserId}/media`, parentParams);
  if (!parent.id) throw new Error("Falha ao criar o carrossel no Instagram");
  await waitContainerFinished(parent.id, pageToken, "o carrossel");
  // 4) publica
  const published = await graphPost(`${igUserId}/media_publish`, {
    creation_id: parent.id,
    access_token: pageToken,
  });
  if (!published.id) throw new Error("Falha ao publicar o carrossel no Instagram");
  return published.id;
}

/** Publica várias fotos numa única publicação na Página do Facebook. */
export async function publishCarouselToFacebook(
  pageId: string,
  pageToken: string,
  opts: { imageUrls: string[]; message: string },
): Promise<string> {
  // 1) sobe cada foto sem publicar
  const attached: string[] = [];
  for (const url of opts.imageUrls) {
    const up = await graphPost(`${pageId}/photos`, {
      url,
      published: "false",
      access_token: pageToken,
    });
    if (!up.id) throw new Error("Falha ao subir uma imagem no Facebook");
    attached.push(up.id);
  }
  // 2) cria o post do feed anexando todas as fotos
  const params: Record<string, string> = { message: opts.message, access_token: pageToken };
  attached.forEach((mediaId, i) => {
    params[`attached_media[${i}]`] = JSON.stringify({ media_fbid: mediaId });
  });
  const r = await graphPost(`${pageId}/feed`, params);
  return (r.id ?? r.post_id) as string;
}

// ── Ler o que JÁ FOI publicado na conta (Estúdio + Meta Business + app) ──────
export interface PublishedMedia {
  id: string;
  platform: "instagram" | "facebook";
  caption: string;
  permalink: string;
  timestamp: string;
  thumb?: string;
  mediaType?: string;
}

/** Mídias publicadas no Instagram da conta (independente de onde foram feitas). */
export async function getInstagramMedia(igUserId: string, token: string, limit = 50): Promise<PublishedMedia[]> {
  type Row = {
    id: string;
    caption?: string;
    media_type?: string;
    media_url?: string;
    thumbnail_url?: string;
    permalink?: string;
    timestamp: string;
  };
  const url = `${GRAPH}/${igUserId}/media?fields=id,caption,media_type,media_url,thumbnail_url,permalink,timestamp&limit=${limit}&access_token=${token}`;
  const j = await graphGet<{ data?: Row[] }>(url);
  return (j.data ?? []).map((m) => ({
    id: m.id,
    platform: "instagram" as const,
    caption: m.caption ?? "",
    permalink: m.permalink ?? "",
    timestamp: m.timestamp,
    thumb: m.thumbnail_url || m.media_url,
    mediaType: m.media_type,
  }));
}

/**
 * GUARDA ANTI-DUPLICAÇÃO. Procura, na própria conta, um post JÁ PUBLICADO com a
 * MESMA legenda nas últimas horas. Se achar, devolve o id dele — aí o publicador
 * adota esse post em vez de publicar de novo (evita republicar o que já saiu
 * quando a 1ª tentativa foi morta no meio). Retorna null se não achar (ou se a
 * legenda for curta/vazia demais pra comparar com segurança).
 */
export async function findRecentPublished(
  platform: "instagram" | "facebook",
  accountId: string,
  token: string,
  caption: string,
): Promise<string | null> {
  const norm = (s: string) => (s || "").replace(/\s+/g, " ").trim().slice(0, 150).toLowerCase();
  const target = norm(caption);
  if (target.length < 12) return null; // curto/vazio: não deduplicar
  const sinceMs = Date.now() - 6 * 60 * 60 * 1000; // 6h
  try {
    if (platform === "instagram") {
      const j = await graphGet<{ data?: { id: string; caption?: string; timestamp: string }[] }>(
        `${GRAPH}/${accountId}/media?fields=id,caption,timestamp&limit=25&access_token=${token}`,
      );
      for (const m of j.data ?? [])
        if (new Date(m.timestamp).getTime() >= sinceMs && norm(m.caption ?? "") === target) return m.id;
    } else {
      const j = await graphGet<{ data?: { id: string; message?: string; created_time: string }[] }>(
        `${GRAPH}/${accountId}/posts?fields=id,message,created_time&limit=25&access_token=${token}`,
      );
      for (const m of j.data ?? [])
        if (new Date(m.created_time).getTime() >= sinceMs && norm(m.message ?? "") === target) return m.id;
    }
  } catch {
    /* se a checagem falhar, não bloqueia a publicação legítima */
  }
  return null;
}

/**
 * GUARDA ANTI-DUPLICAÇÃO POR HORÁRIO (funciona com legenda VAZIA).
 * Usada só em RECUPERAÇÃO (2ª tentativa de um post cuja 1ª morreu no meio).
 * Procura, na própria conta, o post publicado MAIS RECENTE cujo horário é
 * >= `sinceIso` (o horário da 1ª tentativa, com uma folga). Se achar, é quase
 * certo que é o nosso (a 1ª tentativa publicou e morreu antes de gravar).
 * Devolve o id pra ser adotado em vez de publicar de novo. null se não houver.
 */
export async function findPublishedNearTime(
  platform: "instagram" | "facebook",
  accountId: string,
  token: string,
  sinceIso: string,
): Promise<string | null> {
  const sinceMs = new Date(sinceIso).getTime();
  if (!Number.isFinite(sinceMs)) return null;
  try {
    if (platform === "instagram") {
      const j = await graphGet<{ data?: { id: string; timestamp: string }[] }>(
        `${GRAPH}/${accountId}/media?fields=id,timestamp&limit=10&access_token=${token}`,
      );
      const hit = (j.data ?? []).find((m) => new Date(m.timestamp).getTime() >= sinceMs);
      return hit?.id ?? null;
    } else {
      const j = await graphGet<{ data?: { id: string; created_time: string }[] }>(
        `${GRAPH}/${accountId}/posts?fields=id,created_time&limit=10&access_token=${token}`,
      );
      const hit = (j.data ?? []).find((m) => new Date(m.created_time).getTime() >= sinceMs);
      return hit?.id ?? null;
    }
  } catch {
    /* se a checagem falhar, não bloqueia a publicação legítima */
  }
  return null;
}

/** Posts publicados na Página do Facebook (independente de onde foram feitos). */
export async function getFacebookPagePosts(pageId: string, token: string, limit = 50): Promise<PublishedMedia[]> {
  type Row = { id: string; message?: string; created_time: string; permalink_url?: string; full_picture?: string };
  const url = `${GRAPH}/${pageId}/posts?fields=id,message,created_time,permalink_url,full_picture&limit=${limit}&access_token=${token}`;
  const j = await graphGet<{ data?: Row[] }>(url);
  return (j.data ?? []).map((m) => ({
    id: m.id,
    platform: "facebook" as const,
    caption: m.message ?? "",
    permalink: m.permalink_url ?? "",
    timestamp: m.created_time,
    thumb: m.full_picture,
  }));
}

/** Publica um STORY no Instagram (imagem ou vídeo — 24h, fora do feed/grade). */
export async function publishStoryToInstagram(
  igUserId: string,
  pageToken: string,
  opts: { mediaUrl: string; isVideo: boolean },
): Promise<string> {
  const params: Record<string, string> = { media_type: "STORIES", access_token: pageToken };
  if (opts.isVideo) params.video_url = opts.mediaUrl;
  else params.image_url = opts.mediaUrl;

  const container = await graphPost(`${igUserId}/media`, params);
  if (!container.id) throw new Error("Falha ao criar o Story no Instagram");

  if (opts.isVideo) {
    const start = Date.now();
    let status = await getContainerStatus(container.id, pageToken);
    while (status !== "FINISHED" && Date.now() - start < 60000) {
      if (status === "ERROR" || status === "EXPIRED") {
        throw new Error("O Instagram rejeitou o vídeo do Story (use MP4/H.264, vertical 9:16, até 60s).");
      }
      await sleep(4000);
      status = await getContainerStatus(container.id, pageToken);
    }
    if (status !== "FINISHED") {
      throw new Error("O vídeo do Story ainda está processando — clique em publicar de novo em instantes.");
    }
  }

  const published = await graphPost(`${igUserId}/media_publish`, {
    creation_id: container.id,
    access_token: pageToken,
  });
  if (!published.id) throw new Error("Falha ao publicar o Story no Instagram");
  return published.id;
}

/** Publica um STORY na Página do Facebook (foto ou vídeo). */
export async function publishStoryToFacebookPage(
  pageId: string,
  pageToken: string,
  opts: { mediaUrl: string; isVideo: boolean },
): Promise<string> {
  // ----- FOTO: sobe sem publicar, depois vira Story -----
  if (!opts.isVideo) {
    const up = await graphPost(`${pageId}/photos`, {
      url: opts.mediaUrl,
      published: "false",
      access_token: pageToken,
    });
    if (!up.id) throw new Error("Falha ao subir a foto do Story no Facebook");
    const r = await graphPost(`${pageId}/photo_stories`, {
      photo_id: up.id,
      access_token: pageToken,
    });
    return (r.post_id ?? r.id ?? up.id) as string;
  }

  // ----- VÍDEO: sessão de upload (start → envia por file_url → finish) -----
  const startRes = await fetch(`${GRAPH}/${pageId}/video_stories`, {
    method: "POST",
    body: new URLSearchParams({ upload_phase: "start", access_token: pageToken }),
  });
  const start = (await startRes.json()) as {
    video_id?: string;
    upload_url?: string;
    error?: { message?: string };
  };
  if (!start.video_id || !start.upload_url) {
    throw new Error(start.error?.message || "Falha ao iniciar o Story de vídeo no Facebook");
  }

  const upRes = await fetch(start.upload_url, {
    method: "POST",
    headers: { Authorization: `OAuth ${pageToken}`, file_url: opts.mediaUrl },
  });
  if (!upRes.ok) throw new Error(`Falha ao enviar o vídeo do Story pro Facebook (HTTP ${upRes.status})`);

  const finRes = await fetch(`${GRAPH}/${pageId}/video_stories`, {
    method: "POST",
    body: new URLSearchParams({
      upload_phase: "finish",
      video_id: start.video_id,
      access_token: pageToken,
    }),
  });
  const fin = (await finRes.json()) as {
    success?: boolean;
    post_id?: string;
    error?: { message?: string };
  };
  if (fin.error) throw new Error(fin.error.message || "Falha ao finalizar o Story de vídeo no Facebook");
  return fin.post_id ?? start.video_id;
}
