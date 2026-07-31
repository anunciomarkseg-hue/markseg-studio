import { NextResponse } from "next/server";
import { getSupabaseAdmin, supabaseConfigured } from "@/lib/supabase";

export const dynamic = "force-dynamic";

/**
 * Rota de teste da conexão com o Supabase.
 * Abra http://localhost:3000/api/health depois de preencher o .env.local
 * e rodar o schema.sql. Deve retornar { ok: true, contas: 2 }.
 */
export async function GET() {
  if (!supabaseConfigured) {
    return NextResponse.json(
      {
        ok: false,
        reason: "env-missing",
        message: "Faltam SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY no .env.local",
      },
      { status: 500 },
    );
  }

  const { data, error, count } = await getSupabaseAdmin()
    .from("social_accounts")
    .select("id, platform, handle", { count: "exact" });

  if (error) {
    return NextResponse.json(
      { ok: false, reason: "db-error", message: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    contas: count ?? data?.length ?? 0,
    accounts: data,
  });
}
