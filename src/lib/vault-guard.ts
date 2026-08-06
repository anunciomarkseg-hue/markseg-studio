import { createSupabaseServerClient } from "./supabase/server";
import { supabaseConfigured } from "./supabase";
import { accessLevelOf } from "./access";
import { isAdminEmail } from "./admins";
import { canUseVault, type VaultViewer } from "./vault";
import { vaultConfigured } from "./vault-crypto";

export type VaultViewerFull = VaultViewer & { email: string | null };

/**
 * Quem está logado, do ponto de vista do Cofre. Usar SÓ no servidor
 * (rotas /api e server components). Retorna null se não houver sessão.
 */
export async function currentVaultViewer(): Promise<VaultViewerFull | null> {
  try {
    const sb = await createSupabaseServerClient();
    const {
      data: { user },
    } = await sb.auth.getUser();
    if (!user) return null;
    return {
      email: user.email ?? null,
      level: accessLevelOf(user),
      isOwner: isAdminEmail(user.email),
    };
  } catch {
    return null;
  }
}

/** Resultado do guard: ou o viewer autorizado, ou o erro pronto pra responder. */
export type Guarded =
  | { ok: true; viewer: VaultViewerFull }
  | { ok: false; status: number; error: string };

/**
 * Porta de entrada de TODA rota do Cofre: exige Supabase + VAULT_SECRET
 * configurados, sessão válida e nível que possa usar o cofre (admin/editor).
 */
export async function guardVault(): Promise<Guarded> {
  if (!supabaseConfigured) {
    return { ok: false, status: 500, error: "Supabase não configurado." };
  }
  if (!vaultConfigured()) {
    return {
      ok: false,
      status: 500,
      error: "Cofre não configurado — defina VAULT_SECRET no painel da Vercel.",
    };
  }
  const viewer = await currentVaultViewer();
  if (!viewer) return { ok: false, status: 401, error: "Faça login pra acessar o Cofre." };
  if (!canUseVault(viewer.level)) {
    return { ok: false, status: 403, error: "Seu nível não tem acesso ao Cofre." };
  }
  return { ok: true, viewer };
}
