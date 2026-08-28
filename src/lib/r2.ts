import { AwsClient } from "aws4fetch";

/**
 * Cloudflare R2 (S3-compatível) pra guardar mídia grande (vídeo/Reel) de graça.
 * O navegador sobe direto pro R2 via URL pré-assinada — sem passar pela Vercel
 * e sem o limite de 50 MB do Supabase grátis. O Instagram baixa da URL pública.
 */

const ACCOUNT = process.env.R2_ACCOUNT_ID ?? "";
const KEY = process.env.R2_ACCESS_KEY_ID ?? "";
const SECRET = process.env.R2_SECRET_ACCESS_KEY ?? "";
const BUCKET = process.env.R2_BUCKET ?? "";
const PUBLIC_BASE = (process.env.R2_PUBLIC_URL ?? "").replace(/\/$/, "");

export const r2Configured = Boolean(ACCOUNT && KEY && SECRET && BUCKET && PUBLIC_BASE);

const endpoint = () => `https://${ACCOUNT}.r2.cloudflarestorage.com/${BUCKET}`;
const client = () => new AwsClient({ accessKeyId: KEY, secretAccessKey: SECRET, service: "s3", region: "auto" });

/** Gera uma URL pré-assinada de PUT pro navegador subir o arquivo direto. */
export async function presignR2Put(path: string, contentType: string): Promise<string> {
  const url = `${endpoint()}/${path}`;
  const signed = await client().sign(
    new Request(url, { method: "PUT", headers: { "content-type": contentType || "application/octet-stream" } }),
    { aws: { signQuery: true } },
  );
  return signed.url;
}

/** URL pública final (o que a Meta/TikTok vão baixar). */
export function r2PublicUrl(path: string): string {
  return `${PUBLIC_BASE}/${path}`;
}

/** true se a URL aponta pro nosso R2 público (pra saber onde apagar na limpeza). */
export function isR2Url(url: string): boolean {
  return Boolean(PUBLIC_BASE) && url.startsWith(PUBLIC_BASE);
}

/** Extrai o caminho (key) do objeto a partir da URL pública do R2. */
export function r2PathFromUrl(url: string): string | null {
  if (!isR2Url(url)) return null;
  return decodeURIComponent(url.slice(PUBLIC_BASE.length + 1));
}

/**
 * Apaga objetos do R2 (usado na limpeza pós-publicação).
 *
 * Em paralelo e com prazo máximo: antes era um por vez e sem timeout, então
 * uma limpeza com muitos arquivos (ou o R2 lento) segurava a função até a
 * plataforma cortá-la. Devolve quantos falharam, em vez de engolir o erro em
 * silêncio — assim quem mantém o sistema consegue enxergar o problema.
 */
export async function deleteFromR2(paths: string[]): Promise<{ apagados: number; falhas: number }> {
  const c = client();
  const results = await Promise.all(
    paths.map(async (p) => {
      try {
        const res = await c.fetch(`${endpoint()}/${p}`, {
          method: "DELETE",
          signal: AbortSignal.timeout(15000),
        });
        return res.ok || res.status === 404; // já não existe = objetivo cumprido
      } catch {
        return false;
      }
    }),
  );
  const apagados = results.filter(Boolean).length;
  return { apagados, falhas: results.length - apagados };
}
