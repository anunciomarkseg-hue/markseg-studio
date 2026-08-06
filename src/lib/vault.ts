import type { AccessLevel } from "./access";

/**
 * COFRE DE ACESSOS — tipos e regras de sigilo (módulo PURO).
 *
 * Sem import de servidor (nada de `crypto`/Supabase) pra poder ser usado
 * também em componentes "use client" (labels, dropdowns, ícones por nível).
 *
 * Dois mundos que NUNCA se misturam na tela:
 *   • interno  → coisas da agência (ferramentas, bancos, e-mails internos)
 *   • cliente  → uma pasta por cliente
 *
 * 3 níveis de sigilo por pasta (quem consegue REVELAR as senhas dela):
 *   • dono   → só os donos (lista ADMIN_EMAILS). Ex.: bancos.
 *   • admin  → administradores.
 *   • equipe → admin + editor (quem opera as contas dos clientes).
 */

// ── Escopo (interno x cliente) ──────────────────────────────────────────────
export type VaultScope = "interno" | "cliente";

export const SCOPE_LABEL: Record<VaultScope, string> = {
  interno: "Interno da agência",
  cliente: "Clientes",
};

// ── Sigilo ──────────────────────────────────────────────────────────────────
export type Sensitivity = "dono" | "admin" | "equipe";

export const SENSITIVITIES: Sensitivity[] = ["equipe", "admin", "dono"];

export const SENSITIVITY_LABEL: Record<Sensitivity, string> = {
  dono: "Só dono",
  admin: "Admin",
  equipe: "Equipe",
};

export const SENSITIVITY_HINT: Record<Sensitivity, string> = {
  dono: "Só os donos da agência revelam. Indicado pra bancos e coisas críticas.",
  admin: "Administradores revelam. Editores e visualização não veem.",
  equipe: "Admin e editores revelam (quem opera as contas dos clientes).",
};

/** Cor do selo de cada nível (classes Tailwind do tema). */
export const SENSITIVITY_BADGE: Record<Sensitivity, string> = {
  dono: "bg-rose-50 text-rose-700 border-rose-200",
  admin: "bg-amber-50 text-amber-700 border-amber-200",
  equipe: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

// ── Categorias de acesso (o tipo de cada senha, com ícone) ──────────────────
export const VAULT_CATEGORIES = [
  "ferramentas",
  "emails",
  "bancos",
  "redes",
  "hospedagem",
  "outros",
] as const;
export type VaultCategory = (typeof VAULT_CATEGORIES)[number];

export const CATEGORY_LABEL: Record<VaultCategory, string> = {
  ferramentas: "Ferramentas",
  emails: "E-mails",
  bancos: "Bancos",
  redes: "Redes sociais",
  hospedagem: "Hospedagem / Sites",
  outros: "Outros",
};

export function asCategory(v: unknown): VaultCategory {
  return VAULT_CATEGORIES.includes(v as VaultCategory) ? (v as VaultCategory) : "outros";
}

// ── Quem enxerga o quê ──────────────────────────────────────────────────────
/** Retrato do usuário logado pra decidir acesso (montado no servidor). */
export interface VaultViewer {
  level: AccessLevel;
  /** Dono = e-mail na lista ADMIN_EMAILS (mais forte que "admin"). */
  isOwner: boolean;
}

/** true se o viewer pode REVELAR senhas de uma pasta com esse sigilo. */
export function canAccessSensitivity(s: Sensitivity, v: VaultViewer): boolean {
  if (s === "dono") return v.isOwner;
  if (s === "admin") return v.level === "admin";
  return v.level === "admin" || v.level === "editor"; // equipe
}

/** Níveis de sigilo que o viewer pode criar/gerenciar (pro dropdown do form). */
export function allowedSensitivities(v: VaultViewer): Sensitivity[] {
  return SENSITIVITIES.filter((s) => canAccessSensitivity(s, v));
}

/** Pode entrar no Cofre? Hoje: SÓ admin (menu, página, API e middleware usam
 *  esta função). Pra liberar editores no futuro, troque por
 *  `level === "admin" || level === "editor"` — o resto se ajusta sozinho. */
export function canUseVault(level: AccessLevel): boolean {
  return level === "admin";
}

// ── Formatos que o back-end devolve pro navegador ───────────────────────────
export interface VaultFolder {
  id: string;
  scope: VaultScope;
  name: string;
  sensitivity: Sensitivity;
  notes: string;
  count: number; // nº de acessos dentro
  updatedAt: string | null;
}

/** Acesso SEM a senha — é o que trafega na listagem (segredo só no /reveal). */
export interface VaultCredentialSafe {
  id: string;
  folderId: string;
  category: VaultCategory;
  label: string;
  url: string;
  username: string;
  hasPassword: boolean;
  hasExtra: boolean;
  updatedAt: string | null;
}
