import { createBrowserClient } from "@supabase/ssr";

/** Cliente de auth para o navegador (login, criar senha, etc.). */
export function createSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
