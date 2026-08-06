import { getSupabaseAdmin } from "./supabase";
import { encrypt } from "./vault-crypto";
import {
  asCategory,
  type Sensitivity,
  type VaultCredentialSafe,
  type VaultFolder,
  type VaultScope,
} from "./vault";

/**
 * Queries do Cofre — SÓ no servidor (usa a service role do Supabase).
 * As senhas entram/saem cifradas por vault-crypto. A listagem NUNCA devolve
 * a senha: só metadados + "tem senha?". O segredo sai apenas no /reveal.
 */

// ── Linhas cruas do banco ───────────────────────────────────────────────────
interface FolderRow {
  id: string;
  scope: VaultScope;
  name: string;
  sensitivity: Sensitivity;
  notes: string;
  updated_at: string | null;
}
interface CredRow {
  id: string;
  folder_id: string;
  category: string;
  label: string;
  url: string;
  username: string;
  password_enc: string;
  extra_enc: string;
  updated_at: string | null;
}

const s = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);

// ── Pastas ──────────────────────────────────────────────────────────────────
export async function listFolders(): Promise<VaultFolder[]> {
  const sb = getSupabaseAdmin();
  const [{ data: folders, error }, { data: creds }] = await Promise.all([
    sb.from("vault_folders").select("id,scope,name,sensitivity,notes,updated_at").order("name"),
    sb.from("vault_credentials").select("folder_id"),
  ]);
  if (error) throw error;

  const counts = new Map<string, number>();
  for (const c of (creds ?? []) as { folder_id: string }[]) {
    counts.set(c.folder_id, (counts.get(c.folder_id) ?? 0) + 1);
  }

  return ((folders ?? []) as FolderRow[]).map((f) => ({
    id: f.id,
    scope: f.scope,
    name: f.name,
    sensitivity: f.sensitivity,
    notes: f.notes ?? "",
    count: counts.get(f.id) ?? 0,
    updatedAt: f.updated_at,
  }));
}

export async function getFolder(id: string): Promise<FolderRow | null> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("vault_folders")
    .select("id,scope,name,sensitivity,notes,updated_at")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data as FolderRow) ?? null;
}

export async function createFolder(input: {
  scope: VaultScope;
  name: string;
  sensitivity: Sensitivity;
  notes?: string;
}): Promise<string> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("vault_folders")
    .insert({
      scope: input.scope,
      name: s(input.name, 120),
      sensitivity: input.sensitivity,
      notes: s(input.notes, 4000),
    })
    .select("id")
    .single();
  if (error) throw error;
  return (data as { id: string }).id;
}

export async function updateFolder(
  id: string,
  patch: { name?: string; sensitivity?: Sensitivity; notes?: string },
): Promise<void> {
  const sb = getSupabaseAdmin();
  const upd: Record<string, unknown> = {};
  if (patch.name !== undefined) upd.name = s(patch.name, 120);
  if (patch.sensitivity !== undefined) upd.sensitivity = patch.sensitivity;
  if (patch.notes !== undefined) upd.notes = s(patch.notes, 4000);
  if (Object.keys(upd).length === 0) return;
  const { error } = await sb.from("vault_folders").update(upd).eq("id", id);
  if (error) throw error;
}

export async function deleteFolder(id: string): Promise<void> {
  const sb = getSupabaseAdmin();
  const { error } = await sb.from("vault_folders").delete().eq("id", id);
  if (error) throw error;
}

// ── Acessos ─────────────────────────────────────────────────────────────────
export async function listCredentials(folderId: string): Promise<VaultCredentialSafe[]> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("vault_credentials")
    .select("id,folder_id,category,label,url,username,password_enc,extra_enc,updated_at")
    .eq("folder_id", folderId)
    .order("label");
  if (error) throw error;
  return ((data ?? []) as CredRow[]).map((c) => ({
    id: c.id,
    folderId: c.folder_id,
    category: asCategory(c.category),
    label: c.label,
    url: c.url ?? "",
    username: c.username ?? "",
    hasPassword: Boolean(c.password_enc),
    hasExtra: Boolean(c.extra_enc),
    updatedAt: c.updated_at,
  }));
}

/** Acesso cru + a pasta dele (pra checar sigilo e decifrar no /reveal). */
export async function getCredentialWithFolder(
  id: string,
): Promise<{ cred: CredRow; folder: FolderRow } | null> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("vault_credentials")
    .select("id,folder_id,category,label,url,username,password_enc,extra_enc,updated_at")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const cred = data as CredRow;
  const folder = await getFolder(cred.folder_id);
  if (!folder) return null;
  return { cred, folder };
}

export async function createCredential(input: {
  folderId: string;
  category: string;
  label: string;
  url?: string;
  username?: string;
  password?: string;
  extra?: string;
}): Promise<string> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("vault_credentials")
    .insert({
      folder_id: input.folderId,
      category: asCategory(input.category),
      label: s(input.label, 120),
      url: s(input.url, 500),
      username: s(input.username, 320),
      password_enc: encrypt(s(input.password, 2000)),
      extra_enc: encrypt(s(input.extra, 4000)),
    })
    .select("id")
    .single();
  if (error) throw error;
  return (data as { id: string }).id;
}

export async function updateCredential(
  id: string,
  patch: {
    category?: string;
    label?: string;
    url?: string;
    username?: string;
    password?: string; // undefined = não mexe; "" = limpa
    extra?: string;
  },
): Promise<void> {
  const sb = getSupabaseAdmin();
  const upd: Record<string, unknown> = {};
  if (patch.category !== undefined) upd.category = asCategory(patch.category);
  if (patch.label !== undefined) upd.label = s(patch.label, 120);
  if (patch.url !== undefined) upd.url = s(patch.url, 500);
  if (patch.username !== undefined) upd.username = s(patch.username, 320);
  if (patch.password !== undefined) upd.password_enc = encrypt(s(patch.password, 2000));
  if (patch.extra !== undefined) upd.extra_enc = encrypt(s(patch.extra, 4000));
  if (Object.keys(upd).length === 0) return;
  const { error } = await sb.from("vault_credentials").update(upd).eq("id", id);
  if (error) throw error;
}

export async function deleteCredential(id: string): Promise<void> {
  const sb = getSupabaseAdmin();
  const { error } = await sb.from("vault_credentials").delete().eq("id", id);
  if (error) throw error;
}

// ── Auditoria ───────────────────────────────────────────────────────────────
export async function logAccess(entry: {
  credentialId: string;
  credentialLabel: string;
  folderName: string;
  userEmail: string | null;
  action?: "reveal" | "copy";
}): Promise<void> {
  try {
    const sb = getSupabaseAdmin();
    await sb.from("vault_access_log").insert({
      credential_id: entry.credentialId,
      credential_label: s(entry.credentialLabel, 120),
      folder_name: s(entry.folderName, 120),
      user_email: s(entry.userEmail, 320),
      action: entry.action ?? "reveal",
    });
  } catch {
    /* auditoria é best-effort — nunca quebra a revelação da senha */
  }
}
