/**
 * Integração com o TikTok (Content Posting API — Direct Post de vídeo).
 * Server-only. Usa TIKTOK_CLIENT_KEY / TIKTOK_CLIENT_SECRET.
 *
 * Requisitos no TikTok for Developers:
 *  - Produto "Login Kit" + "Content Posting API" adicionados ao app.
 *  - Scopes: user.info.basic, video.publish
 *  - AUDITORIA do app aprovada pra postar PÚBLICO. Sem auditoria, o TikTok só
 *    aceita privacy_level=SELF_ONLY (vídeo fica privado/só você vê).
 *
 * Diferente da Meta: o access_token do TikTok EXPIRA (~24h). Guardamos o
 * refresh_token (válido ~365 dias) e renovamos na hora de publicar — é isso que
 * faz o AGENDADOR funcionar pra datas distantes.
 */

import { getSupabaseAdmin } from "./supabase";

const TT_CLIENT_KEY = process.env.TIKTOK_CLIENT_KEY ?? "";
const TT_CLIENT_SECRET = process.env.TIKTOK_CLIENT_SECRET ?? "";

/** fetch com prazo máximo — evita que uma resposta lenta do TikTok pendure a
 *  função até o corte da plataforma. */
function fetchT(url: string, init: RequestInit = {}, ms = 25000): Promise<Response> {
  return fetch(url, { ...init, signal: AbortSignal.timeout(ms) });
}
/** SELF_ONLY até a auditoria passar. Depois troque pra PUBLIC_TO_EVERYONE no .env. */
const TT_PRIVACY = process.env.TIKTOK_DEFAULT_PRIVACY ?? "SELF_ONLY";

export const tiktokConfigured = Boolean(TT_CLIENT_KEY && TT_CLIENT_SECRET);

/** Scopes pra puxar o nome do perfil e publicar vídeo direto. */
export const TIKTOK_SCOPES = "user.info.basic,video.publish";

const AUTH_BASE = "https://www.tiktok.com/v2/auth/authorize/";
const API = "https://open.tiktokapis.com/v2";

export function getTikTokLoginUrl(redirectUri: string, state: string): string {
  const p = new URLSearchParams({
    client_key: TT_CLIENT_KEY,
    scope: TIKTOK_SCOPES,
    response_type: "code",
    redirect_uri: redirectUri,
    state,
  });
  return `${AUTH_BASE}?${p.toString()}`;
}

interface TikTokTokens {
  accessToken: string;
  refreshToken: string;
  openId: string;
  expiresIn: number; // segundos
}

async function tokenRequest(body: Record<string, string>): Promise<TikTokTokens> {
  const res = await fetchT(`${API}/oauth/token/`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_key: TT_CLIENT_KEY,
      client_secret: TT_CLIENT_SECRET,
      ...body,
    }),
  });
  const json = (await res.json()) as {
    access_token?: string;
    refresh_token?: string;
    open_id?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
  };
  if (!json.access_token || !json.refresh_token) {
    throw new Error(json.error_description || json.error || "Falha no login do TikTok");
  }
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    openId: json.open_id ?? "",
    expiresIn: json.expires_in ?? 86400,
  };
}

export function exchangeTikTokCode(code: string, redirectUri: string): Promise<TikTokTokens> {
  return tokenRequest({ code, grant_type: "authorization_code", redirect_uri: redirectUri });
}

export function refreshTikTokToken(refreshToken: string): Promise<TikTokTokens> {
  return tokenRequest({ grant_type: "refresh_token", refresh_token: refreshToken });
}

export interface TikTokCreator {
  username: string;
  displayName: string;
}

/** Nome do criador conectado (pra exibir em "Contas"). Só usa user.info.basic. */
export async function getTikTokCreator(token: string): Promise<TikTokCreator> {
  const res = await fetchT(`${API}/user/info/?fields=open_id,display_name,avatar_url`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const json = (await res.json()) as {
    data?: { user?: { display_name?: string } };
  };
  const u = json.data?.user;
  return { username: "", displayName: u?.display_name || "TikTok" };
}

/**
 * Garante um access_token válido pra conta `accountId`, renovando via
 * refresh_token se estiver perto de expirar, e persiste o resultado.
 */
export async function ensureTikTokToken(acc: {
  id: string;
  access_token: string;
  refresh_token?: string | null;
  token_expires_at?: string | null;
}): Promise<string> {
  const expMs = acc.token_expires_at ? new Date(acc.token_expires_at).getTime() : 0;
  const valid = expMs - Date.now() > 5 * 60 * 1000; // 5 min de folga
  if (valid) return acc.access_token;
  if (!acc.refresh_token) {
    throw new Error("Sessão do TikTok expirada — reconecte a conta em Contas.");
  }

  const t = await refreshTikTokToken(acc.refresh_token);
  const token_expires_at = new Date(Date.now() + t.expiresIn * 1000).toISOString();
  await getSupabaseAdmin()
    .from("social_accounts")
    .update({
      access_token: t.accessToken,
      refresh_token: t.refreshToken,
      token_expires_at,
    })
    .eq("id", acc.id);
  return t.accessToken;
}

const jsonHeaders = (token: string) => ({
  Authorization: `Bearer ${token}`,
  "Content-Type": "application/json; charset=UTF-8",
});

/**
 * Publica um vídeo direto no TikTok (Direct Post) via FILE_UPLOAD.
 * Retorna o publish_id quando o TikTok confirma a publicação.
 */
export async function publishToTikTokVideo(
  token: string,
  opts: { videoUrl: string; caption: string },
): Promise<string> {
  // 1) baixa o vídeo do nosso Storage
  const bytes = new Uint8Array(await (await fetchT(opts.videoUrl, {}, 45000)).arrayBuffer());
  const size = bytes.byteLength;
  if (size === 0) throw new Error("Vídeo vazio ou inacessível pro TikTok.");

  // 2) inicializa o post (Direct Post)
  const initRes = await fetchT(`${API}/post/publish/video/init/`, {
    method: "POST",
    headers: jsonHeaders(token),
    body: JSON.stringify({
      post_info: {
        title: opts.caption.slice(0, 2200),
        privacy_level: TT_PRIVACY,
        disable_duet: false,
        disable_comment: false,
        disable_stitch: false,
        video_cover_timestamp_ms: 1000,
      },
      source_info: {
        source: "FILE_UPLOAD",
        video_size: size,
        chunk_size: size, // único chunk (vídeos curtos)
        total_chunk_count: 1,
      },
    }),
  });
  const init = (await initRes.json()) as {
    data?: { publish_id?: string; upload_url?: string };
    error?: { code?: string; message?: string };
  };
  if (!init.data?.upload_url || !init.data.publish_id) {
    const code = init.error?.code && init.error.code !== "ok" ? `[${init.error.code}] ` : "";
    const msg = `${code}${init.error?.message || ""}`.trim() || `HTTP ${initRes.status}`;
    throw new Error(`TikTok recusou iniciar a publicação: ${msg}`);
  }

  // 3) envia os bytes do vídeo
  const up = await fetchT(init.data.upload_url, {
    method: "PUT",
    headers: {
      "Content-Type": "video/mp4",
      "Content-Length": String(size),
      "Content-Range": `bytes 0-${size - 1}/${size}`,
    },
    body: bytes,
  }, 45000); // enviar os bytes do vídeo demora mais que uma chamada normal
  if (!up.ok) throw new Error(`Falha ao enviar o vídeo pro TikTok (HTTP ${up.status}).`);

  // 4) acompanha o status até concluir
  const publishId = init.data.publish_id;
  const start = Date.now();
  while (Date.now() - start < 90000) {
    await new Promise((r) => setTimeout(r, 4000));
    const stRes = await fetchT(`${API}/post/publish/status/fetch/`, {
      method: "POST",
      headers: jsonHeaders(token),
      body: JSON.stringify({ publish_id: publishId }),
    });
    const st = (await stRes.json()) as {
      data?: { status?: string; fail_reason?: string };
    };
    const status = st.data?.status;
    if (status === "PUBLISH_COMPLETE") return publishId;
    if (status === "FAILED") {
      throw new Error(`TikTok falhou ao publicar: ${st.data?.fail_reason || "motivo desconhecido"}.`);
    }
  }
  // ainda processando — o vídeo deve sair em instantes
  return publishId;
}
