import type { SocialAccount } from "./types";

/**
 * Agrupa contas por "cliente". Um cliente reúne o Instagram + a Página do
 * Facebook que compartilham o mesmo group_key (= id da Página, definido no
 * login da Meta). Contas sem group_key viram um cliente só delas.
 */

export interface Client {
  key: string;
  name: string;
  accounts: SocialAccount[];
}

export function groupKeyOf(a: SocialAccount): string {
  return a.group_key || a.id;
}

export function buildClients(accounts: SocialAccount[]): Client[] {
  const map = new Map<string, SocialAccount[]>();
  for (const a of accounts) {
    const k = groupKeyOf(a);
    const arr = map.get(k);
    if (arr) arr.push(a);
    else map.set(k, [a]);
  }

  const clients: Client[] = [];
  for (const [key, accs] of map) {
    const fb = accs.find((a) => a.platform === "facebook");
    clients.push({ key, name: fb?.name ?? accs[0].name, accounts: accs });
  }
  return clients.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

/** ids das contas de um cliente (pra pré-selecionar no composer / filtrar). */
export function accountIdsForGroup(accounts: SocialAccount[], groupKey: string | null): string[] {
  if (!groupKey) return [];
  return accounts.filter((a) => groupKeyOf(a) === groupKey).map((a) => a.id);
}
