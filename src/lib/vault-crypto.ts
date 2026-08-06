import crypto from "node:crypto";

/**
 * Criptografia do Cofre — AES-256-GCM (autenticado).
 *
 * ⚠️ SÓ no servidor. A chave vem da env VAULT_SECRET (defina no painel da
 * Vercel — NUNCA no código). Qualquer texto (senha, 2FA) vira um blob base64
 * `iv(12) + tag(16) + cifra`. Sem a VAULT_SECRET não dá pra ler nada.
 *
 * Não é criptografia ponta-a-ponta (o servidor tem a chave), mas protege
 * contra vazamento do banco e contra quem não tem login/nível suficiente.
 */

const IV_LEN = 12; // GCM recomenda 96 bits
const TAG_LEN = 16;

export function vaultConfigured(): boolean {
  return Boolean(process.env.VAULT_SECRET);
}

/** Deriva uma chave de 32 bytes a partir da VAULT_SECRET (aceita qualquer formato). */
function key(): Buffer {
  const secret = process.env.VAULT_SECRET;
  if (!secret) {
    throw new Error(
      "VAULT_SECRET não configurada — defina a chave do Cofre no painel da Vercel.",
    );
  }
  return crypto.createHash("sha256").update(secret, "utf8").digest();
}

/** Cifra um texto. Vazio entra, vazio sai (não guarda senha em branco). */
export function encrypt(plain: string): string {
  if (!plain) return "";
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64");
}

/** Decifra um blob gerado por encrypt(). Blob vazio → string vazia. */
export function decrypt(blob: string): string {
  if (!blob) return "";
  const raw = Buffer.from(blob, "base64");
  const iv = raw.subarray(0, IV_LEN);
  const tag = raw.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const data = raw.subarray(IV_LEN + TAG_LEN);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}
