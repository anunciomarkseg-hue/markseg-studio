"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, Loader2, PlugZap, RefreshCw } from "lucide-react";
import type { SocialAccount } from "@/lib/types";
import { fmtFollowers } from "@/lib/format";
import { Avatar } from "@/components/Avatar";

const PLATFORM_LABEL: Record<string, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  linkedin: "LinkedIn",
  tiktok: "TikTok",
};

/** Onde reconectar cada rede (o botão da Meta não serve pro LinkedIn/TikTok). */
const RECONNECT_URL: Record<string, string> = {
  instagram: "/api/meta/oauth",
  facebook: "/api/meta/oauth",
  linkedin: "/api/linkedin/oauth",
  tiktok: "/api/tiktok/oauth",
};

export function AccountCard({ account }: { account: SocialAccount }) {
  const router = useRouter();
  const [testando, setTestando] = useState(false);
  const [resultado, setResultado] = useState<{
    estado: "ok" | "morto" | "indeterminado";
    texto: string;
  } | null>(null);

  /** Pergunta pra própria rede se o token ainda vale e corrige o estado. */
  async function testar() {
    setTestando(true);
    setResultado(null);
    try {
      const res = await fetch(`/api/accounts/${account.id}/check`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? `Falha no teste (código ${res.status})`);
      if (data.estado === "ok") {
        setResultado({ estado: "ok", texto: "Conexão OK, a conta publica normalmente." });
      } else if (data.estado === "morto") {
        setResultado({ estado: "morto", texto: data.error ?? "A rede recusou o acesso." });
      } else {
        // Não deu pra concluir. Dizemos isso em vez de chutar — e o estado da
        // conta no banco fica como estava.
        setResultado({
          estado: "indeterminado",
          texto: `Não deu pra concluir o teste: ${data.error ?? "sem detalhe"}. O estado da conta não foi alterado.`,
        });
      }
      router.refresh();
    } catch (e) {
      setResultado({ estado: "indeterminado", texto: (e as Error).message });
    } finally {
      setTestando(false);
    }
  }

  const rede = PLATFORM_LABEL[account.platform] ?? account.platform;
  const reconectar = RECONNECT_URL[account.platform] ?? "/api/meta/oauth";

  return (
    <div className="card p-4">
      <div className="flex items-center gap-4">
        <Avatar account={account} size={48} />

        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <span className="min-w-0 truncate font-semibold text-ink">{account.handle}</span>
            {account.needs_reconnect ? (
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
            {rede}
            {account.platform === "tiktok" ? "" : ` · ${fmtFollowers(account.followers)} seguidores`}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            onClick={testar}
            disabled={testando}
            title="Pergunta pra rede se o acesso ainda vale, sem publicar nada"
            className="flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-sm font-semibold text-muted transition-fluid hover:text-ink disabled:opacity-50"
          >
            {testando ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <PlugZap className="h-3.5 w-3.5" />
            )}
            <span className="hidden sm:inline">Testar conexão</span>
          </button>
          <a
            href={reconectar}
            className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-semibold transition-fluid ${
              account.needs_reconnect
                ? "border-rose-300 bg-rose-50 text-rose-700 hover:brightness-95"
                : "border-line text-muted hover:text-ink"
            }`}
          >
            <RefreshCw className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Reconectar</span>
          </a>
        </div>
      </div>

      {/* Motivo REAL guardado no banco. Antes a tela dizia sempre "o acesso
          caducou", mesmo quando a rede tinha reclamado de outra coisa. */}
      {account.needs_reconnect && !resultado && (
        <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3">
          <p className="text-xs font-semibold text-rose-700">
            A última tentativa de publicar nesta conta falhou.
          </p>
          {account.token_error ? (
            <p className="mt-1 break-words font-mono text-[11px] leading-relaxed text-rose-600">
              {account.token_error}
            </p>
          ) : (
            <p className="mt-1 text-xs text-rose-600">
              Sem motivo guardado. Clique em <b>Testar conexão</b> pra perguntar agora pro {rede}.
            </p>
          )}
          <p className="mt-2 text-xs text-rose-600">
            Este aviso pode estar velho. <b>Testar conexão</b> confere na hora e limpa sozinho se o
            acesso estiver bom.
          </p>
        </div>
      )}

      {resultado && (
        <div
          className={`mt-3 flex items-start gap-2 rounded-xl border p-3 ${
            resultado.estado === "ok"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : resultado.estado === "morto"
                ? "border-rose-200 bg-rose-50 text-rose-700"
                : "border-amber-300 bg-amber-50 text-amber-900"
          }`}
        >
          {resultado.estado === "ok" ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          ) : (
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          )}
          <p className="break-words text-xs font-medium">{resultado.texto}</p>
        </div>
      )}
    </div>
  );
}
