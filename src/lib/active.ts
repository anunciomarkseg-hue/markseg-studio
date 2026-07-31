import { cookies } from "next/headers";

/** Cliente "ativo" escolhido no seletor do topo (cookie). null = todos.
 *  Guarda o group_key do cliente (IG + FB juntos). */
export async function getActiveGroup(): Promise<string | null> {
  const c = await cookies();
  return c.get("active_client")?.value || null;
}
