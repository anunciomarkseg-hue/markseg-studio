import { createSupabaseServerClient } from "@/lib/supabase/server";
import { accessLevelOf, type AccessLevel } from "@/lib/access";

/** Quem está logado + seu nível (pro módulo Central). */
export async function currentAgent(): Promise<{ email: string | null; level: AccessLevel }> {
  try {
    const sb = await createSupabaseServerClient();
    const {
      data: { user },
    } = await sb.auth.getUser();
    return { email: user?.email ?? null, level: accessLevelOf(user) };
  } catch {
    return { email: null, level: "viewer" };
  }
}

/** Atende no painel (responde e-mails) = admin ou editor. */
export function canAttend(level: AccessLevel): boolean {
  return level === "admin" || level === "editor";
}
