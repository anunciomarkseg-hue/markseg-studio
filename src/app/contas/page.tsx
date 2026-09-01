import { Plus, CheckCircle2, ShieldCheck, AlertCircle, AlertTriangle } from "lucide-react";
import { listAccounts } from "@/lib/db";
import type { SocialAccount } from "@/lib/types";
import { AccountCard } from "@/components/AccountCard";
import { PlatformIcon } from "@/components/PlatformIcon";

export const dynamic = "force-dynamic";

export default async function ContasPage({
  searchParams,
}: {
  searchParams: Promise<{
    conectado?: string;
    erro?: string;
    vistas?: string;
    naoapareceram?: string;
    maisnaoapareceram?: string;
    sempermissao?: string;
    maissempermissao?: string;
    truncado?: string;
  }>;
}) {
  const sp = await searchParams;
  let accounts: SocialAccount[] = [];
  try {
    accounts = await listAccounts();
  } catch {
    // mostra vazio se o banco falhar
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 animate-rise">
        <h1 className="font-display text-2xl font-bold text-ink">Contas conectadas</h1>
        <p className="mt-1 text-sm text-muted">
          Conecte os perfis do Instagram e páginas do Facebook que a MarkSeg gerencia.
        </p>
      </div>

      {sp.conectado && (
        <div className="mb-5 flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-800 animate-rise">
          <CheckCircle2 className="h-5 w-5 shrink-0" />
          <p className="text-sm font-medium">
            {sp.conectado} conta(s) conectada(s) com sucesso! 🎉
          </p>
        </div>
      )}
      {sp.erro && (
        <div className="mb-5 flex items-center gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-700 animate-rise">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <p className="text-sm font-medium">Não deu pra conectar: {sp.erro}</p>
        </div>
      )}

      {/* Diagnóstico da última reconexão. Sem isto a tela dizia só "N conta(s)
          conectada(s)" e as Páginas que ficaram de fora sumiam sem aviso.
          Os dois casos ficam SEPARADOS de propósito: "não apareceu" e
          "apareceu sem permissão" têm soluções diferentes. */}
      {(sp.naoapareceram || sp.sempermissao || sp.truncado) && (
        <div className="mb-5 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-amber-900 animate-rise">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <AlertTriangle className="h-5 w-5 shrink-0" /> A reconexão não cobriu tudo
          </p>

          {sp.vistas && (
            <p className="mt-2 text-sm">
              O Facebook mostrou <b>{sp.vistas} Página(s)</b> para o login que você usou.
            </p>
          )}

          {sp.sempermissao && (
            <div className="mt-3 rounded-xl border border-amber-300 bg-white/60 p-3">
              <p className="text-sm font-semibold">Apareceram, mas sem permissão de publicar</p>
              <p className="mt-1 text-sm">
                <b>{sp.sempermissao}</b>
                {sp.maissempermissao ? ` e mais ${sp.maissempermissao}` : ""}.
              </p>
              <p className="mt-1 text-xs">
                O Facebook enxerga essas Páginas no seu login, mas não liberou publicação. Em Meta
                Business Suite, Configurações do negócio, Páginas, aba Pessoas: seu usuário precisa
                de acesso total, ou no mínimo &quot;Criar publicações&quot; com &quot;Gerenciar
                Página&quot;. Analista e Anunciante não servem.
              </p>
            </div>
          )}

          {sp.naoapareceram && (
            <div className="mt-3 rounded-xl border border-amber-300 bg-white/60 p-3">
              <p className="text-sm font-semibold">Nem apareceram na lista</p>
              <p className="mt-1 text-sm">
                <b>{sp.naoapareceram}</b>
                {sp.maisnaoapareceram ? ` e mais ${sp.maisnaoapareceram}` : ""}.
              </p>
              <p className="mt-1 text-xs">
                Não é permissão de publicar: o login que você usou não alcança essas Páginas de
                jeito nenhum. Ou elas estão em outro Business, ou o seu usuário foi removido delas,
                ou quem precisa reconectar é outra pessoa. Elas continuam com o acesso antigo.
              </p>
            </div>
          )}

          {sp.truncado && (
            <p className="mt-3 text-sm">
              A lista de Páginas veio <b>incompleta</b> (a Meta demorou demais pra responder). Tente
              reconectar de novo antes de investigar o resto.
            </p>
          )}

          <p className="mt-3 text-xs">
            Dica: use <b>Testar conexão</b> na conta que ficou de fora pra ver o motivo exato que a
            rede dá.
          </p>
        </div>
      )}

      <div className="space-y-3">
        {accounts.map((a) => (
          <AccountCard key={a.id} account={a} />
        ))}

        {/* Conectar nova → login real da Meta */}
        <a
          href="/api/meta/oauth"
          className="card flex w-full items-center gap-4 border-2 border-dashed border-brand-blue/30 bg-brand-blue-50/40 p-4 text-left transition-fluid hover:bg-brand-blue-50"
        >
          <span className="gradient-brand grid h-12 w-12 place-items-center rounded-full text-white">
            <Plus className="h-6 w-6" strokeWidth={2.6} />
          </span>
          <div>
            <div className="font-semibold text-ink">Conectar conta da Meta</div>
            <div className="text-xs text-muted">
              Login oficial do Facebook → traz suas Páginas e Instagram automaticamente.
            </div>
          </div>
        </a>

        {/* Conectar LinkedIn */}
        <a
          href="/api/linkedin/oauth"
          className="card flex w-full items-center gap-4 border border-line p-4 text-left transition-fluid hover:bg-canvas"
        >
          <span className="grid h-12 w-12 place-items-center rounded-full bg-[#0a66c2] text-white">
            <PlatformIcon platform="linkedin" className="h-6 w-6" />
          </span>
          <div>
            <div className="font-semibold text-ink">Conectar LinkedIn</div>
            <div className="text-xs text-muted">
              Páginas de empresa (requer a Community Management API aprovada no LinkedIn).
            </div>
          </div>
        </a>

        {/* Conectar TikTok */}
        <a
          href="/api/tiktok/oauth"
          className="card flex w-full items-center gap-4 border border-line p-4 text-left transition-fluid hover:bg-canvas"
        >
          <span className="grid h-12 w-12 place-items-center rounded-full bg-ink text-white">
            <PlatformIcon platform="tiktok" className="h-6 w-6" />
          </span>
          <div>
            <div className="font-semibold text-ink">Conectar TikTok</div>
            <div className="text-xs text-muted">
              Publica e agenda vídeos (requer a Content Posting API com auditoria aprovada).
            </div>
          </div>
        </a>
      </div>

      <div className="mt-6 flex items-start gap-3 rounded-2xl bg-brand-blue-50/60 p-4 text-sm text-brand-blue-700">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" />
        <p>
          A conexão usa o login oficial da Meta (OAuth). Nós nunca vemos sua senha — apenas um token de
          acesso que você pode revogar quando quiser.
        </p>
      </div>
    </div>
  );
}
