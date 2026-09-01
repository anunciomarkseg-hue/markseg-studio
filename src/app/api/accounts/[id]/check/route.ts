import { NextResponse } from "next/server";
import { getSupabaseAdmin, supabaseConfigured } from "@/lib/supabase";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { accessLevelOf, canManageAccounts } from "@/lib/access";
import { checkMetaToken, type TesteConexao } from "@/lib/meta";
import { checkLinkedInToken } from "@/lib/linkedin";
import { checkTikTokToken } from "@/lib/tiktok";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Testa a conexão de UMA conta contra a API da rede e corrige o estado no banco.
 *
 * Motivo de existir: `needs_reconnect` era um palpite guardado. Ele podia ficar
 * aceso para sempre (uma conta de LinkedIn/TikTok nunca era limpa, e uma conta
 * que não publicava havia meses carregava um erro velho), e a tela ainda por
 * cima trocava o motivo real por uma frase fixa. Aqui a resposta vem da fonte:
 *
 *  - token vivo  → apaga a flag e o erro guardado (a conta fica verde na hora)
 *  - token morto → grava o texto LITERAL que a rede devolveu, pra tela mostrar
 *
 * Não publica nada e não altera post nenhum.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!supabaseConfigured) {
    return NextResponse.json({ error: "Supabase não configurado" }, { status: 500 });
  }

  // Falha FECHADA, no mesmo padrão das outras rotas: sem sessão legível, recusa.
  // A tela /contas já é restrita a admin no middleware — a rota repete a regra
  // em vez de confiar nisso.
  let nivelOk = false;
  try {
    const sbAuth = await createSupabaseServerClient();
    const {
      data: { user },
    } = await sbAuth.auth.getUser();
    nivelOk = canManageAccounts(accessLevelOf(user));
  } catch {
    nivelOk = false;
  }
  if (!nivelOk) {
    return NextResponse.json(
      { error: "Só admin pode testar a conexão das contas." },
      { status: 403 },
    );
  }

  const { id } = await params;
  const sb = getSupabaseAdmin();

  const { data: acc, error: readErr } = await sb
    .from("social_accounts")
    .select("id, platform, handle, external_id, access_token, refresh_token, token_expires_at")
    .eq("id", id)
    .maybeSingle();
  if (readErr) return NextResponse.json({ error: readErr.message }, { status: 500 });
  if (!acc) return NextResponse.json({ error: "Conta não encontrada" }, { status: 404 });

  let resultado: TesteConexao;
  if (acc.platform === "facebook" || acc.platform === "instagram") {
    resultado = await checkMetaToken(acc.external_id, acc.access_token, acc.platform);
  } else if (acc.platform === "linkedin") {
    resultado = await checkLinkedInToken(acc.access_token);
  } else if (acc.platform === "tiktok") {
    resultado = await checkTikTokToken(acc);
  } else {
    return NextResponse.json(
      { error: `Não sei testar a plataforma "${acc.platform}".` },
      { status: 400 },
    );
  }

  // O banco passa a refletir o que a rede acabou de dizer, e não um palpite
  // antigo. É isto que apaga um alerta que ficou preso.
  //
  // "indeterminado" NÃO mexe na flag de propósito: rede caída, 500 da
  // plataforma ou erro de permissão não provam que a credencial morreu. Marcar
  // vermelho aí seria recriar o bug que esta rota existe pra consertar.
  if (resultado.estado === "ok") {
    await sb
      .from("social_accounts")
      .update({ needs_reconnect: false, token_error: null })
      .eq("id", id);
  } else if (resultado.estado === "morto") {
    await sb
      .from("social_accounts")
      .update({
        needs_reconnect: true,
        token_error: (resultado.error ?? "").slice(0, 300) || null,
      })
      .eq("id", id);
  }

  return NextResponse.json({
    estado: resultado.estado,
    handle: acc.handle,
    platform: acc.platform,
    error: resultado.error ?? null,
  });
}
