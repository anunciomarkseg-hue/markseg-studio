import { Plus, RefreshCw, CheckCircle2, ShieldCheck, AlertCircle } from "lucide-react";
import { listAccounts } from "@/lib/db";
import { fmtFollowers } from "@/lib/format";
import type { SocialAccount } from "@/lib/types";
import { Avatar } from "@/components/Avatar";
import { PlatformIcon } from "@/components/PlatformIcon";

export const dynamic = "force-dynamic";

export default async function ContasPage({
  searchParams,
}: {
  searchParams: Promise<{ conectado?: string; erro?: string }>;
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

      <div className="space-y-3">
        {accounts.map((a) => (
          <div key={a.id} className="card flex items-center gap-4 p-4">
            <Avatar account={a} size={48} />
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 items-center gap-2">
                <span className="min-w-0 truncate font-semibold text-ink">{a.handle}</span>
                {a.needs_reconnect ? (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-700">
                    <AlertCircle className="h-3 w-3" /> <span className="hidden sm:inline">Reconecte</span>
                  </span>
                ) : (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                    <CheckCircle2 className="h-3 w-3" /> <span className="hidden sm:inline">Conectada</span>
                  </span>
                )}
              </div>
              <div className="truncate text-xs text-muted">
                {{ instagram: "Instagram", facebook: "Facebook", linkedin: "LinkedIn", tiktok: "TikTok" }[a.platform] ?? a.platform}
                {a.platform === "tiktok" ? "" : ` · ${fmtFollowers(a.followers)} seguidores`}
              </div>
              {a.needs_reconnect && (
                <p className="mt-1 text-xs font-medium text-rose-600">
                  O acesso caducou — clique em Reconectar pra voltar a publicar.
                </p>
              )}
            </div>
            <a
              href="/api/meta/oauth"
              className={`flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-semibold transition-fluid ${
                a.needs_reconnect
                  ? "border-rose-300 bg-rose-50 text-rose-700 hover:brightness-95"
                  : "border-line text-muted hover:text-ink"
              }`}
            >
              <RefreshCw className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Reconectar</span>
            </a>
          </div>
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
