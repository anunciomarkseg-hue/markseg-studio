"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Loader2,
  Send,
  RefreshCw,
  Inbox,
  Settings,
  CheckCircle2,
  AlertCircle,
  Mail,
} from "lucide-react";

type ConversationRow = {
  id: string;
  subject: string;
  contact_email: string;
  contact_name: string | null;
  status: "aberto" | "pendente" | "resolvido";
  unread: boolean;
  last_message_at: string;
  mailbox_label: string;
  preview: string;
};

type Message = {
  id: string;
  direction: "in" | "out";
  from_email: string | null;
  from_name: string | null;
  subject: string | null;
  body_text: string | null;
  author_email: string | null;
  sent_at: string;
};

const STATUS_TABS: { key: "" | "aberto" | "pendente" | "resolvido"; label: string }[] = [
  { key: "", label: "Todas" },
  { key: "aberto", label: "Abertas" },
  { key: "pendente", label: "Pendentes" },
  { key: "resolvido", label: "Resolvidas" },
];

function fmt(iso: string): string {
  try {
    return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

export function CentralClient({ isAdmin }: { isAdmin: boolean }) {
  const [tab, setTab] = useState<"" | "aberto" | "pendente" | "resolvido">("");
  const [convs, setConvs] = useState<ConversationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingThread, setLoadingThread] = useState(false);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [banner, setBanner] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/central/conversations${tab ? `?status=${tab}` : ""}`);
      const data = await res.json().catch(() => ({}));
      if (res.ok) setConvs(data.conversations ?? []);
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => {
    load();
  }, [load]);

  const openConv = useCallback(async (id: string) => {
    setSelected(id);
    setLoadingThread(true);
    setReply("");
    try {
      const res = await fetch(`/api/central/conversations/${id}`);
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setMessages(data.messages ?? []);
        setConvs((prev) => prev.map((c) => (c.id === id ? { ...c, unread: false } : c)));
      }
    } finally {
      setLoadingThread(false);
    }
  }, []);

  async function sendReply() {
    if (!selected || !reply.trim()) return;
    setSending(true);
    setBanner(null);
    try {
      const res = await fetch(`/api/central/conversations/${selected}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: reply }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Falha ao enviar.");
      setReply("");
      setBanner({ kind: "ok", text: "Resposta enviada ✅" });
      openConv(selected);
      load();
    } catch (e) {
      setBanner({ kind: "err", text: (e as Error).message });
    } finally {
      setSending(false);
    }
  }

  async function setStatus(status: "aberto" | "pendente" | "resolvido") {
    if (!selected) return;
    await fetch(`/api/central/conversations/${selected}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    load();
  }

  async function syncNow() {
    setSyncing(true);
    setBanner(null);
    try {
      const res = await fetch("/api/central/sync", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Falha ao sincronizar.");
      setBanner({ kind: "ok", text: `Sincronizado — ${data.novos ?? 0} novo(s) e-mail(s).` });
      load();
    } catch (e) {
      setBanner({ kind: "err", text: (e as Error).message });
    } finally {
      setSyncing(false);
    }
  }

  const current = convs.find((c) => c.id === selected) ?? null;

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 font-display text-2xl font-bold text-ink">
            <Inbox className="h-6 w-6 text-brand-blue" /> Central de Atendimento
          </h1>
          <p className="mt-1 text-sm text-muted">Todos os e-mails num painel só. Responda direto por aqui.</p>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <button
              onClick={syncNow}
              disabled={syncing}
              className="flex items-center gap-1.5 rounded-xl border border-line bg-surface px-3 py-2 text-sm font-semibold text-ink transition-fluid hover:bg-canvas disabled:opacity-50"
            >
              {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Sincronizar
            </button>
          )}
          {isAdmin && (
            <Link
              href="/central/config"
              className="flex items-center gap-1.5 rounded-xl border border-line bg-surface px-3 py-2 text-sm font-semibold text-ink transition-fluid hover:bg-canvas"
            >
              <Settings className="h-4 w-4" /> Caixas
            </Link>
          )}
        </div>
      </div>

      {banner && (
        <div
          className={`mb-4 flex items-center gap-2 rounded-xl border p-3 text-sm font-medium ${
            banner.kind === "ok"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-rose-200 bg-rose-50 text-rose-700"
          }`}
        >
          {banner.kind === "ok" ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
          {banner.text}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-5">
        {/* Lista */}
        <div className="lg:col-span-2">
          <div className="mb-3 flex gap-1 rounded-xl bg-canvas p-1">
            {STATUS_TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-semibold transition-fluid ${
                  tab === t.key ? "bg-white text-ink shadow-sm" : "text-muted"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="space-y-2">
            {loading ? (
              <div className="flex items-center gap-2 py-8 text-sm text-muted">
                <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
              </div>
            ) : convs.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-line p-8 text-center text-sm text-muted">
                <Mail className="mx-auto mb-2 h-6 w-6 opacity-50" />
                Nenhuma conversa ainda.
                {isAdmin && <span className="block">Conecte uma caixa em “Caixas” e clique em Sincronizar.</span>}
              </div>
            ) : (
              convs.map((c) => (
                <button
                  key={c.id}
                  onClick={() => openConv(c.id)}
                  className={`w-full rounded-xl border p-3 text-left transition-fluid ${
                    selected === c.id ? "border-brand-blue bg-brand-blue-50" : "border-line bg-surface hover:bg-canvas"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className={`truncate text-sm ${c.unread ? "font-bold text-ink" : "font-semibold text-ink"}`}>
                      {c.contact_name || c.contact_email}
                    </span>
                    <span className="shrink-0 text-[10px] text-muted">{fmt(c.last_message_at)}</span>
                  </div>
                  <p className="truncate text-xs font-medium text-ink/80">{c.subject}</p>
                  <p className="truncate text-xs text-muted">{c.preview}</p>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="rounded-full bg-canvas px-2 py-0.5 text-[10px] font-semibold text-muted">
                      {c.mailbox_label}
                    </span>
                    {c.unread && <span className="h-2 w-2 rounded-full bg-brand-blue" />}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Thread */}
        <div className="lg:col-span-3">
          {!selected ? (
            <div className="grid h-full min-h-64 place-items-center rounded-2xl border border-dashed border-line text-sm text-muted">
              Selecione uma conversa pra ler e responder.
            </div>
          ) : (
            <div className="flex flex-col rounded-2xl border border-line bg-surface">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line p-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-ink">{current?.subject}</p>
                  <p className="truncate text-xs text-muted">
                    {current?.contact_name ? `${current.contact_name} · ` : ""}
                    {current?.contact_email}
                  </p>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => setStatus("pendente")} className="rounded-lg border border-line px-2 py-1 text-xs font-semibold text-muted hover:text-ink">
                    Pendente
                  </button>
                  <button onClick={() => setStatus("resolvido")} className="rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700 hover:brightness-95">
                    Resolver
                  </button>
                </div>
              </div>

              <div className="max-h-[46vh] space-y-3 overflow-y-auto p-4">
                {loadingThread ? (
                  <div className="flex items-center gap-2 py-6 text-sm text-muted">
                    <Loader2 className="h-4 w-4 animate-spin" /> Abrindo…
                  </div>
                ) : (
                  messages.map((m) => (
                    <div key={m.id} className={`flex ${m.direction === "out" ? "justify-end" : "justify-start"}`}>
                      <div
                        className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                          m.direction === "out"
                            ? "bg-brand-blue text-white"
                            : "border border-line bg-canvas text-ink"
                        }`}
                      >
                        <p className="whitespace-pre-wrap break-words">{m.body_text || "(sem texto)"}</p>
                        <p className={`mt-1 text-[10px] ${m.direction === "out" ? "text-white/70" : "text-muted"}`}>
                          {m.direction === "out" ? m.author_email || "equipe" : m.from_name || m.from_email} · {fmt(m.sent_at)}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="border-t border-line p-3">
                <textarea
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  placeholder="Escreva a resposta…"
                  className="h-24 w-full resize-none rounded-xl border border-line bg-canvas p-3 text-sm text-ink outline-none focus:border-brand-blue focus:bg-white"
                />
                <div className="mt-2 flex justify-end">
                  <button
                    onClick={sendReply}
                    disabled={sending || !reply.trim()}
                    className="gradient-brand flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white transition-fluid hover:opacity-95 disabled:opacity-50"
                  >
                    {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    Responder
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
