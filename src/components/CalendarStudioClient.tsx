"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  FileText,
  Loader2,
  CalendarClock,
  CalendarDays,
  ClipboardList,
  Copy,
  Check,
  Trash2,
  ExternalLink,
  Share2,
  Pencil,
  ChevronLeft,
} from "lucide-react";
import type { Client } from "@/lib/clients";
import type { CalendarWithPosts } from "@/lib/calendar";
import { CalendarView } from "@/components/CalendarView";

export function CalendarStudioClient({
  activeGroup,
  clients,
  calendars,
}: {
  activeGroup: string | null;
  clients: Client[];
  calendars: CalendarWithPosts[];
}) {
  const router = useRouter();
  const activeClient = clients.find((c) => c.key === activeGroup) ?? null;

  const [openId, setOpenId] = useState<string | null>(calendars[0]?.id ?? null);
  const opened = useMemo(() => calendars.find((c) => c.id === openId) ?? null, [calendars, openId]);

  const pdfInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const publicUrl = (token: string) =>
    typeof window !== "undefined" ? `${window.location.origin}/cal/${token}` : `/cal/${token}`;

  async function importPdf(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setMsg(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await fetch("/api/calendario/import", { method: "POST", body: fd });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        setMsg({ ok: false, text: d.error ?? "Erro ao ler o PDF." });
      } else {
        setMsg({ ok: true, text: `✅ ${d.created} posts lidos — calendário “${d.title}” criado.` });
        setOpenId(d.id);
        router.refresh();
      }
    } catch (err) {
      setMsg({ ok: false, text: "Erro ao subir: " + (err as Error).message });
    } finally {
      setImporting(false);
      if (pdfInputRef.current) pdfInputRef.current.value = "";
    }
  }

  async function copyLink(token: string, id: string) {
    try {
      await navigator.clipboard.writeText(publicUrl(token));
      setCopiedId(id);
      setTimeout(() => setCopiedId((c) => (c === id ? null : c)), 1600);
    } catch {
      setMsg({ ok: false, text: "Não consegui copiar. O link é: " + publicUrl(token) });
    }
  }

  async function rename(id: string, current: string) {
    const val = window.prompt("Nome do calendário:", current);
    if (val == null || val.trim() === current) return;
    await fetch(`/api/calendario/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: val.trim() }),
    }).catch(() => {});
    router.refresh();
  }

  async function editTheme(id: string, current: string) {
    const val = window.prompt("Tema do mês (aparece no topo do calendário):", current);
    if (val == null) return;
    await fetch(`/api/calendario/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ theme: val.trim() }),
    }).catch(() => {});
    router.refresh();
  }

  async function remove(id: string, title: string) {
    if (!window.confirm(`Excluir o calendário “${title}”? Isso apaga a visualização e o link do cliente.`)) return;
    await fetch(`/api/calendario/${id}`, { method: "DELETE" }).catch(() => {});
    if (openId === id) setOpenId(null);
    setMsg({ ok: true, text: "Calendário excluído." });
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-6xl">
      {/* ===== Alternador Aprovação / Calendário visual ===== */}
      <div className="mb-4 inline-flex rounded-xl border border-line bg-surface p-1">
        <Link
          href="/pauta"
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold text-muted hover:text-ink"
        >
          <ClipboardList className="h-4 w-4" /> Aprovação
        </Link>
        <span className="flex items-center gap-1.5 rounded-lg bg-brand-blue-50 px-3 py-1.5 text-sm font-semibold text-brand-blue-700">
          <CalendarDays className="h-4 w-4" /> Calendário visual
        </span>
      </div>

      {/* ===== Cabeçalho ===== */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink">Calendário editorial</h1>
          <p className="mt-1 text-sm text-muted">
            {activeClient ? (
              <>
                Suba a pauta em PDF de <span className="font-semibold text-ink">{activeClient.name}</span> e ela vira um
                calendário visual pra compartilhar com o cliente.
              </>
            ) : (
              "Escolha um cliente no topo pra subir a pauta dele."
            )}
          </p>
        </div>
        {activeClient && (
          <div className="flex items-center gap-2">
            <input ref={pdfInputRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={importPdf} />
            <button
              onClick={() => pdfInputRef.current?.click()}
              disabled={importing}
              className="gradient-brand flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition-fluid hover:opacity-95 disabled:opacity-60"
            >
              {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
              {importing ? "Lendo PDF…" : "Subir pauta (PDF)"}
            </button>
          </div>
        )}
      </div>

      {msg && (
        <div
          className={`mb-4 rounded-xl border p-3 text-sm font-medium ${
            msg.ok ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-rose-200 bg-rose-50 text-rose-700"
          }`}
        >
          {msg.text}
        </div>
      )}

      {!activeClient ? (
        <div className="card grid place-items-center gap-2 p-12 text-center text-sm text-muted">
          <CalendarClock className="h-7 w-7" />
          Selecione um cliente no seletor do topo pra montar o calendário editorial dele.
        </div>
      ) : calendars.length === 0 ? (
        <button
          onClick={() => pdfInputRef.current?.click()}
          className="flex w-full flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-line bg-canvas p-12 text-center text-muted transition-fluid hover:border-brand-blue/50 hover:text-ink"
        >
          <FileText className="h-8 w-8" />
          <span className="text-sm font-semibold">Suba a pauta em PDF de {activeClient.name}</span>
          <span className="text-xs">
            Leio as datas, formatos e temas do mês e monto o calendário automaticamente.
          </span>
        </button>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
          {/* ===== Lista de calendários (meses) ===== */}
          <div className="space-y-2">
            <p className="px-1 text-xs font-bold uppercase tracking-wide text-muted">Calendários</p>
            {calendars.map((c) => {
              const on = c.id === openId;
              return (
                <div
                  key={c.id}
                  className={`rounded-2xl border p-3 transition-fluid ${
                    on ? "border-brand-blue bg-brand-blue-50/60" : "border-line bg-surface hover:border-brand-blue/40"
                  }`}
                >
                  <button onClick={() => setOpenId(c.id)} className="block w-full text-left">
                    <p className="text-sm font-bold text-ink">{c.title || "Calendário"}</p>
                    <p className="text-xs text-muted">
                      {c.posts.length} post{c.posts.length > 1 ? "s" : ""}
                      {c.theme ? ` · ${c.theme}` : ""}
                    </p>
                  </button>
                  <div className="mt-2 flex flex-wrap items-center gap-1">
                    <button
                      onClick={() => copyLink(c.token, c.id)}
                      className="flex items-center gap-1 rounded-lg bg-brand-blue px-2 py-1 text-[11px] font-semibold text-white hover:opacity-90"
                    >
                      {copiedId === c.id ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                      {copiedId === c.id ? "Copiado" : "Link"}
                    </button>
                    <a
                      href={publicUrl(c.token)}
                      target="_blank"
                      rel="noreferrer"
                      className="grid h-6 w-6 place-items-center rounded-lg border border-line text-muted hover:text-ink"
                      title="Abrir link do cliente"
                    >
                      <ExternalLink className="h-3 w-3" />
                    </a>
                    <button
                      onClick={() => rename(c.id, c.title)}
                      className="grid h-6 w-6 place-items-center rounded-lg border border-line text-muted hover:text-ink"
                      title="Renomear"
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                    <button
                      onClick={() => remove(c.id, c.title)}
                      className="grid h-6 w-6 place-items-center rounded-lg border border-line text-rose-500 hover:bg-rose-50"
                      title="Excluir"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* ===== Prévia do calendário selecionado ===== */}
          <div className="min-w-0">
            {opened ? (
              <>
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setOpenId(null)}
                      className="grid h-8 w-8 place-items-center rounded-lg border border-line text-muted hover:text-ink lg:hidden"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <h2 className="font-display text-lg font-bold text-ink">{opened.title}</h2>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => editTheme(opened.id, opened.theme)}
                      className="rounded-lg border border-line bg-surface px-3 py-1.5 text-xs font-semibold text-ink hover:bg-canvas"
                    >
                      {opened.theme ? "Editar tema" : "Definir tema"}
                    </button>
                    <button
                      onClick={() => copyLink(opened.token, opened.id)}
                      className="flex items-center gap-1.5 rounded-lg bg-brand-blue px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90"
                    >
                      {copiedId === opened.id ? <Check className="h-3.5 w-3.5" /> : <Share2 className="h-3.5 w-3.5" />}
                      {copiedId === opened.id ? "Copiado" : "Compartilhar"}
                    </button>
                  </div>
                </div>
                <CalendarView theme={opened.theme} posts={opened.posts} />
              </>
            ) : (
              <div className="card grid place-items-center gap-2 p-12 text-center text-sm text-muted">
                <CalendarDays className="h-7 w-7" />
                Selecione um calendário na lista pra visualizar.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
