"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Loader2, KeyRound, CheckCircle2 } from "lucide-react";
import { type EmailOtpType } from "@supabase/supabase-js";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function DefinirSenhaPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const [ready, setReady] = useState(false);

  // Cria a sessão a partir do link do e-mail. O convite padrão do Supabase
  // entrega o login no HASH da URL (#access_token=...); também tratamos
  // token_hash (verifyOtp) e code (PKCE) como reforço. Sem isso, "criar senha"
  // falha porque não existe sessão — foi o que travou os primeiros convites.
  useEffect(() => {
    const sb = createSupabaseBrowserClient();
    (async () => {
      try {
        const { data } = await sb.auth.getSession();
        if (data.session) return;

        // 1) tokens no hash (fluxo padrão do link de convite)
        const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
        const access_token = hash.get("access_token");
        const refresh_token = hash.get("refresh_token");
        if (access_token && refresh_token) {
          await sb.auth.setSession({ access_token, refresh_token });
          // limpa o hash da URL (não deixa o token à mostra)
          window.history.replaceState(null, "", window.location.pathname);
          return;
        }

        // 2) token_hash / code na query (reforço)
        const params = new URLSearchParams(window.location.search);
        const token_hash = params.get("token_hash");
        const type = params.get("type") as EmailOtpType | null;
        const code = params.get("code");
        if (token_hash && type) await sb.auth.verifyOtp({ type, token_hash });
        else if (code) await sb.auth.exchangeCodeForSession(code);
      } catch {
        /* o submit avisa se ainda faltar sessão */
      } finally {
        setReady(true);
      }
    })();
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("A senha precisa ter pelo menos 8 caracteres.");
      return;
    }
    if (password !== confirm) {
      setError("As senhas não conferem.");
      return;
    }
    setLoading(true);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setError(
        "Não foi possível definir a senha. Abra esta página pelo link do e-mail de convite e tente de novo.",
      );
      setLoading(false);
      return;
    }
    setDone(true);
    setTimeout(() => {
      router.push("/");
      router.refresh();
    }, 1200);
  }

  return (
    <div className="grid min-h-screen place-items-center bg-canvas px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex justify-center">
          <Image src="/brand/markseg-logo.png" alt="MarkSeg" width={150} height={43} priority />
        </div>

        <form onSubmit={onSubmit} className="card space-y-4 p-6">
          <div>
            <h1 className="font-display text-xl font-bold text-ink">Criar sua senha</h1>
            <p className="mt-1 text-sm text-muted">Defina uma senha para acessar a ferramenta.</p>
          </div>

          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">
              {error}
            </div>
          )}
          {done && (
            <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">
              <CheckCircle2 className="h-4 w-4" /> Senha criada! Entrando…
            </div>
          )}

          <div>
            <label className="mb-1 block text-xs font-semibold text-muted">Nova senha</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="mínimo 8 caracteres"
              className="w-full rounded-xl border border-line bg-canvas px-3 py-2.5 text-sm text-ink outline-none transition-fluid focus:border-brand-blue focus:bg-white"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-muted">Confirmar senha</label>
            <input
              type="password"
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="repita a senha"
              className="w-full rounded-xl border border-line bg-canvas px-3 py-2.5 text-sm text-ink outline-none transition-fluid focus:border-brand-blue focus:bg-white"
            />
          </div>

          <button
            type="submit"
            disabled={loading || done || !ready}
            className="gradient-brand flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition-fluid hover:opacity-95 disabled:opacity-50"
          >
            {loading || !ready ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
            {!ready ? "Validando o link…" : "Criar senha e entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}
