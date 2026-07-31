"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Loader2, LogIn } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError("E-mail ou senha incorretos.");
      setLoading(false);
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <div className="grid min-h-screen place-items-center bg-canvas px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex justify-center">
          <Image src="/brand/markseg-logo.png" alt="MarkSeg" width={150} height={43} priority />
        </div>

        <form onSubmit={onSubmit} className="card space-y-4 p-6">
          <div>
            <h1 className="font-display text-xl font-bold text-ink">Entrar no MarkSeg Studio</h1>
            <p className="mt-1 text-sm text-muted">Ferramenta interna da equipe.</p>
          </div>

          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">
              {error}
            </div>
          )}

          <div>
            <label className="mb-1 block text-xs font-semibold text-muted">E-mail</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="voce@markseg.com.br"
              className="w-full rounded-xl border border-line bg-canvas px-3 py-2.5 text-sm text-ink outline-none transition-fluid focus:border-brand-blue focus:bg-white"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-muted">Senha</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-xl border border-line bg-canvas px-3 py-2.5 text-sm text-ink outline-none transition-fluid focus:border-brand-blue focus:bg-white"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="gradient-brand flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition-fluid hover:opacity-95 disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
            Entrar
          </button>

          <p className="text-center text-xs text-muted">
            Acesso só para membros convidados da equipe MarkSeg.
          </p>
        </form>
      </div>
    </div>
  );
}
