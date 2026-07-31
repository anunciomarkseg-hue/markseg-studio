import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Cliente "admin" do Supabase — usa a SERVICE ROLE KEY.
 *
 * ⚠️ SÓ pode ser usado no servidor (rotas /api, server components).
 * NUNCA importe isto em componente com "use client": a service role key
 * dá acesso total ao banco e não pode vazar pro navegador.
 *
 * A criação é "preguiçosa" (getSupabaseAdmin) porque o createClient lança
 * erro se a URL estiver vazia — assim conseguimos dar uma mensagem amigável
 * quando o .env.local ainda não foi preenchido.
 */
const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

/** true quando as variáveis estão configuradas. */
export const supabaseConfigured = Boolean(url && serviceKey);

let _client: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (!supabaseConfigured) {
    throw new Error(
      "Supabase não configurado: defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.local",
    );
  }
  if (!_client) {
    _client = createClient(url as string, serviceKey as string, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return _client;
}
