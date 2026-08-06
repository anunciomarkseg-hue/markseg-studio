"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Send, CheckCircle2, AlertCircle, Users, Trash2 } from "lucide-react";
import { ACCESS_LABEL, ACCESS_LEVELS, ACCESS_HINT, type AccessLevel } from "@/lib/access";

type Member = {
  id: string;
  email: string;
  name: string;
  role: string;
  level: AccessLevel;
  fixedAdmin: boolean;
  confirmed: boolean;
  lastSignIn: string | null;
  createdAt: string | null;
};

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return "—";
  }
}

const LEVEL_BADGE: Record<AccessLevel, string> = {
  admin: "bg-brand-blue-50 text-brand-blue-700",
  editor: "bg-violet-50 text-violet-700",
  viewer: "bg-slate-100 text-slate-600",
};

export function EquipeClient() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [level, setLevel] = useState<AccessLevel>("editor");
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [members, setMembers] = useState<Member[]>([]);
  const [loadingList, setLoadingList] = useState(true);

  const loadMembers = useCallback(async () => {
    setLoadingList(true);
    try {
      const res = await fetch("/api/admin/invite");
      const data = await res.json().catch(() => ({}));
      if (res.ok) setMembers(data.users ?? []);
    } catch {
      /* silencioso — a lista é secundária */
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setDone(null);
    setSending(true);
    try {
      const res = await fetch("/api/admin/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name, role, access_level: level }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Não consegui enviar o convite.");
      setDone(
        `Convite enviado para ${data.email ?? email} como ${ACCESS_LABEL[level]}. A pessoa vai receber um e-mail pra criar a senha.`,
      );
      setEmail("");
      setName("");
      setRole("");
      loadMembers();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSending(false);
    }
  }

  async function changeLevel(userId: string, access_level: AccessLevel) {
    setMembers((prev) => prev.map((m) => (m.id === userId ? { ...m, level: access_level } : m)));
    try {
      const res = await fetch("/api/admin/invite", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, access_level }),
      });
      if (!res.ok) loadMembers(); // reverte se o servidor recusou
    } catch {
      loadMembers();
    }
  }

  async function removeMember(m: Member) {
    if (!window.confirm(`Excluir ${m.name || m.email} da plataforma? Essa ação não volta.`)) return;
    setMembers((prev) => prev.filter((x) => x.id !== m.id)); // otimista
    try {
      const res = await fetch(`/api/admin/invite?userId=${encodeURIComponent(m.id)}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Não consegui excluir.");
        loadMembers(); // reverte
      }
    } catch {
      loadMembers();
    }
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 animate-rise">
        <h1 className="flex items-center gap-2 font-display text-2xl font-bold text-ink">
          <Users className="h-6 w-6 text-brand-blue" /> Equipe & acessos
        </h1>
        <p className="mt-1 text-sm text-muted">
          Convide pessoas por e-mail e defina o nível de acesso. Elas recebem um link pra criar a senha.
        </p>
      </div>

      {/* Convidar */}
      <section className="card p-5">
        <h2 className="mb-4 text-sm font-semibold text-ink">Convidar alguém</h2>

        {done && (
          <div className="mb-4 flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-emerald-800">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            <p className="text-sm font-medium">{done}</p>
          </div>
        )}
        {error && (
          <div className="mb-4 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-rose-700">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <p className="text-sm font-medium">{error}</p>
          </div>
        )}

        <form onSubmit={invite} className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-semibold text-muted">E-mail *</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ana.financeiro@markseg.com.br"
              className="w-full rounded-xl border border-line bg-canvas px-3 py-2.5 text-sm text-ink outline-none transition-fluid focus:border-brand-blue focus:bg-white"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-muted">Nome (opcional)</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ana Souza"
              className="w-full rounded-xl border border-line bg-canvas px-3 py-2.5 text-sm text-ink outline-none transition-fluid focus:border-brand-blue focus:bg-white"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-muted">Setor / cargo (opcional)</label>
            <input
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder="Financeiro"
              className="w-full rounded-xl border border-line bg-canvas px-3 py-2.5 text-sm text-ink outline-none transition-fluid focus:border-brand-blue focus:bg-white"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-semibold text-muted">Nível de acesso</label>
            <div className="flex flex-wrap gap-2">
              {ACCESS_LEVELS.map((lvl) => (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => setLevel(lvl)}
                  className={`rounded-xl border px-3 py-1.5 text-sm font-semibold transition-fluid ${
                    level === lvl
                      ? "border-brand-blue bg-brand-blue-50 text-brand-blue-700"
                      : "border-line bg-canvas text-muted hover:text-ink"
                  }`}
                >
                  {ACCESS_LABEL[lvl]}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-xs text-muted">{ACCESS_HINT[level]}</p>
          </div>
          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={sending}
              className="gradient-brand flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white shadow-card transition-fluid hover:opacity-95 disabled:opacity-50"
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Enviar convite
            </button>
          </div>
        </form>
      </section>

      {/* Quem já está */}
      <section className="card mt-6 p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink">Na plataforma ({members.length})</h2>
          <button
            onClick={loadMembers}
            disabled={loadingList}
            className="text-xs font-semibold text-brand-blue transition-fluid hover:underline disabled:opacity-50"
          >
            Atualizar
          </button>
        </div>

        {loadingList ? (
          <div className="flex items-center gap-2 py-6 text-sm text-muted">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
          </div>
        ) : members.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted">Ninguém ainda. Envie o primeiro convite acima.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs text-muted">
                  <th className="pb-2 pr-3 font-semibold">Pessoa</th>
                  <th className="pb-2 pr-3 font-semibold">Nível</th>
                  <th className="pb-2 pr-3 font-semibold">Status</th>
                  <th className="pb-2 pr-3 font-semibold">Entrou em</th>
                  <th className="pb-2 font-semibold"></th>
                </tr>
              </thead>
              <tbody>
                {members.map((m) => (
                  <tr key={m.id} className="border-b border-line/60 last:border-0">
                    <td className="py-2.5 pr-3">
                      <span className="block font-semibold text-ink">{m.name || m.email.split("@")[0]}</span>
                      <span className="block text-xs text-muted">
                        {m.email}
                        {m.role ? ` · ${m.role}` : ""}
                      </span>
                    </td>
                    <td className="py-2.5 pr-3">
                      {m.fixedAdmin ? (
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${LEVEL_BADGE.admin}`}>
                          Admin (fixo)
                        </span>
                      ) : (
                        <select
                          value={m.level}
                          onChange={(e) => changeLevel(m.id, e.target.value as AccessLevel)}
                          className="rounded-lg border border-line bg-canvas px-2 py-1 text-xs font-semibold text-ink outline-none focus:border-brand-blue"
                        >
                          {ACCESS_LEVELS.map((lvl) => (
                            <option key={lvl} value={lvl}>
                              {ACCESS_LABEL[lvl]}
                            </option>
                          ))}
                        </select>
                      )}
                    </td>
                    <td className="py-2.5 pr-3">
                      {m.confirmed ? (
                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                          Ativo
                        </span>
                      ) : (
                        <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">
                          Convite pendente
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 pr-3 text-xs text-muted">{fmtDate(m.createdAt)}</td>
                    <td className="py-2.5 text-right">
                      {!m.fixedAdmin && (
                        <button
                          onClick={() => removeMember(m)}
                          title="Excluir da plataforma"
                          aria-label="Excluir"
                          className="inline-grid h-8 w-8 place-items-center rounded-lg text-slate-400 transition-fluid hover:bg-rose-50 hover:text-rose-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
