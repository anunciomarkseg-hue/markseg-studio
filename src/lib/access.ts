import { isAdminEmail } from "./admins";

/**
 * Níveis de acesso do Studio.
 *  - admin  → tudo (convida equipe, conecta contas, publica, apaga)
 *  - editor → cria/agenda/publica posts, pauta e calendário; NÃO gerencia equipe/contas
 *  - viewer → só VÊ (relatórios, calendário, pauta); NÃO publica. Pode postar no Mural.
 *
 * Este módulo é PURO (sem import de servidor) pra poder ser usado no middleware,
 * em server components e em componentes client.
 */
export type AccessLevel = "admin" | "editor" | "viewer";

export const ACCESS_LEVELS: AccessLevel[] = ["admin", "editor", "viewer"];

export const ACCESS_LABEL: Record<AccessLevel, string> = {
  admin: "Admin",
  editor: "Editor",
  viewer: "Visualização",
};

export const ACCESS_HINT: Record<AccessLevel, string> = {
  admin: "Acesso total: convida equipe, conecta contas, publica e apaga.",
  editor: "Publica e agenda posts, mexe na pauta e no calendário.",
  viewer: "Só visualiza (relatórios, calendário, pauta) e pode postar avisos no Mural.",
};

type UserLike =
  | { email?: string | null; user_metadata?: Record<string, unknown> | null }
  | null
  | undefined;

/** Resolve o nível de um usuário: lista de admins vence; depois user_metadata;
 *  usuários antigos sem nível continuam como "editor" (comportamento atual). */
export function accessLevelOf(user: UserLike): AccessLevel {
  if (!user) return "viewer";
  if (isAdminEmail(user.email)) return "admin";
  const lvl = user.user_metadata?.access_level;
  if (lvl === "admin" || lvl === "editor" || lvl === "viewer") return lvl;
  return "editor";
}

export const canPublish = (l: AccessLevel) => l === "admin" || l === "editor";
export const canManageAccounts = (l: AccessLevel) => l === "admin";
export const canManageTeam = (l: AccessLevel) => l === "admin";
export const canEditContent = (l: AccessLevel) => l === "admin" || l === "editor";
// Mural: TODOS os níveis podem postar avisos (inclusive Visualização).
