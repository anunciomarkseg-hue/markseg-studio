import { createSupabaseServerClient } from "./supabase/server";
import { isAdminEmail } from "./admins";

/**
 * true se o usuário logado (via cookie de sessão) é admin. Usar SÓ no servidor
 * (rotas /api, server components) — importa o cliente de servidor do Supabase.
 * Fica separado de admins.ts pra este último continuar puro (usável no middleware).
 */
export async function isCurrentUserAdmin(): Promise<boolean> {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return isAdminEmail(user?.email);
  } catch {
    return false;
  }
}
