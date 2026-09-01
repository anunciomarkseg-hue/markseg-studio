/**
 * Integração com o LinkedIn (postar em Páginas de empresa / organizations).
 * Server-only. Usa LINKEDIN_CLIENT_ID / LINKEDIN_CLIENT_SECRET.
 * Requer o produto "Community Management API" aprovado no app do LinkedIn.
 */

const LI_CLIENT_ID = process.env.LINKEDIN_CLIENT_ID ?? "";
const LI_CLIENT_SECRET = process.env.LINKEDIN_CLIENT_SECRET ?? "";
const LI_VERSION = process.env.LINKEDIN_API_VERSION ?? "202405";

export const linkedinConfigured = Boolean(LI_CLIENT_ID && LI_CLIENT_SECRET);

/** fetch com prazo máximo — sem isto, uma resposta lenta do LinkedIn pendura a
 *  função até a plataforma cortá-la (o usuário vê a tela "travada"). */
function fetchT(url: string, init: RequestInit = {}, ms = 25000): Promise<Response> {
  return fetch(url, { ...init, signal: AbortSignal.timeout(ms) });
}

/** Postar em Página de empresa precisa destes scopes (Community Management API). */
export const LINKEDIN_SCOPES = "r_organization_admin w_organization_social";

export function getLinkedInLoginUrl(redirectUri: string, state: string): string {
  const p = new URLSearchParams({
    response_type: "code",
    client_id: LI_CLIENT_ID,
    redirect_uri: redirectUri,
    state,
    scope: LINKEDIN_SCOPES,
  });
  return `https://www.linkedin.com/oauth/v2/authorization?${p.toString()}`;
}

export async function exchangeLinkedInCode(code: string, redirectUri: string): Promise<string> {
  const res = await fetchT("https://www.linkedin.com/oauth/v2/accessToken", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: LI_CLIENT_ID,
      client_secret: LI_CLIENT_SECRET,
    }),
  });
  const json = (await res.json()) as { access_token?: string; error_description?: string; error?: string };
  if (!json.access_token) {
    throw new Error(json.error_description || json.error || "Falha no login do LinkedIn");
  }
  return json.access_token;
}

export interface LinkedInOrg {
  id: string;
  name: string;
}

const liHeaders = (token: string) => ({
  Authorization: `Bearer ${token}`,
  "X-Restli-Protocol-Version": "2.0.0",
});

/** Lista as Páginas de empresa que o usuário administra. */
export async function getLinkedInOrganizations(token: string): Promise<LinkedInOrg[]> {
  const aclRes = await fetchT(
    "https://api.linkedin.com/v2/organizationAcls?q=roleAssignee&role=ADMINISTRATOR&state=APPROVED",
    { headers: liHeaders(token) },
  );
  const acl = (await aclRes.json()) as {
    elements?: { organization?: string }[];
    message?: string;
  };
  if (!aclRes.ok) {
    throw new Error(acl.message || "Falha ao listar Páginas do LinkedIn (a Community Management API já foi aprovada?)");
  }

  const urns = (acl.elements ?? []).map((e) => e.organization).filter(Boolean) as string[];
  const orgs: LinkedInOrg[] = [];
  for (const urn of urns) {
    const id = urn.split(":").pop() as string;
    try {
      const oRes = await fetchT(
        `https://api.linkedin.com/v2/organizations/${id}?projection=(id,localizedName,vanityName)`,
        { headers: liHeaders(token) },
      );
      const o = (await oRes.json()) as { localizedName?: string; vanityName?: string };
      orgs.push({ id, name: o.localizedName || o.vanityName || `Página ${id}` });
    } catch {
      orgs.push({ id, name: `Página ${id}` });
    }
  }
  return orgs;
}

async function liPost(path: string, token: string, body: unknown): Promise<Response> {
  return fetchT(`https://api.linkedin.com${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "X-Restli-Protocol-Version": "2.0.0",
      "LinkedIn-Version": LI_VERSION,
    },
    body: JSON.stringify(body),
  });
}

async function uploadLinkedInImage(orgId: string, token: string, imageUrl: string): Promise<string> {
  const initRes = await liPost("/rest/images?action=initializeUpload", token, {
    initializeUploadRequest: { owner: `urn:li:organization:${orgId}` },
  });
  const init = (await initRes.json()) as { value?: { uploadUrl?: string; image?: string } };
  const uploadUrl = init.value?.uploadUrl;
  const imageUrn = init.value?.image;
  if (!uploadUrl || !imageUrn) throw new Error("Falha ao iniciar o upload da imagem no LinkedIn");

  const bytes = new Uint8Array(await (await fetch(imageUrl, { signal: AbortSignal.timeout(30000) })).arrayBuffer());
  const up = await fetchT(uploadUrl, {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}` },
    body: bytes,
  });
  if (!up.ok) throw new Error("Falha ao enviar a imagem pro LinkedIn");
  return imageUrn;
}

/** Publica na Página de empresa. Texto + imagem (vídeo entra depois). Retorna o id. */
export async function publishToLinkedIn(
  orgId: string,
  token: string,
  opts: { text: string; imageUrl?: string },
): Promise<string> {
  const body: Record<string, unknown> = {
    author: `urn:li:organization:${orgId}`,
    commentary: opts.text,
    visibility: "PUBLIC",
    distribution: { feedDistribution: "MAIN_FEED", targetEntities: [], thirdPartyDistributionChannels: [] },
    lifecycleState: "PUBLISHED",
    isReshareDisabledByAuthor: false,
  };
  if (opts.imageUrl) {
    body.content = { media: { id: await uploadLinkedInImage(orgId, token, opts.imageUrl) } };
  }

  const res = await liPost("/rest/posts", token, body);
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { message?: string };
    throw new Error(err.message || `LinkedIn recusou a publicação (HTTP ${res.status})`);
  }
  return res.headers.get("x-restli-id") || res.headers.get("x-linkedin-id") || "linkedin-post";
}

/** Apaga um post do LinkedIn (URN retornado na publicação). */
export async function deleteLinkedInPost(postUrn: string, token: string): Promise<void> {
  const res = await fetchT(`https://api.linkedin.com/rest/posts/${encodeURIComponent(postUrn)}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
      "X-Restli-Protocol-Version": "2.0.0",
      "LinkedIn-Version": LI_VERSION,
    },
  });
  if (!res.ok && res.status !== 404) {
    const err = (await res.json().catch(() => ({}))) as { message?: string };
    throw new Error(err.message || `LinkedIn recusou apagar (HTTP ${res.status})`);
  }
}

/** Confere se o token do LinkedIn ainda vale, perguntando à API. Devolve o
 *  motivo literal quando não vale, em vez de a gente supor. */
export async function checkLinkedInToken(token: string): Promise<{ ok: boolean; error?: string }> {
  if (!token) return { ok: false, error: "Conta sem token guardado — reconecte." };
  try {
    const res = await fetchT(
      "https://api.linkedin.com/v2/organizationAcls?q=roleAssignee&role=ADMINISTRATOR&state=APPROVED&count=1",
      { headers: liHeaders(token) },
    );
    const json = (await res.json()) as { message?: string };
    if (!res.ok) return { ok: false, error: json.message || `LinkedIn recusou (HTTP ${res.status})` };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
