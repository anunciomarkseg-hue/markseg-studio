"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  FileText,
  Loader2,
  CalendarDays,
  ClipboardList,
  Copy,
  Check,
  Trash2,
  ExternalLink,
  Share2,
  Pencil,
  ChevronLeft,
  X,
  Upload,
} from "lucide-react";
import type { CalendarWithPosts, CalendarPostStatus } from "@/lib/calendar";
import { CalendarView } from "@/components/CalendarView";

export function CalendarStudioClient({
  calendars,
  clientSuggestions,
  activeClientName,
}: {
  calendars: CalendarWithPosts[];
  clientSuggestions: string[];
  activeClientName: string;
}) {
  const router = useRouter();

  const [openId, setOpenId] = useState<string | null>(calendars[0]?.id ?? null);
  const opened = useMemo(() => calendars.find((c) => c.id === openId) ?? null, [calendars, openId]);

  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [statusBusyId, setStatusBusyId] = useState<string | null>(null);

  // Modal de upload (pede o NOME DO CLIENTE — não depende de conta conectada)
  const [showUpload, setShowUpload] = useState(false);
  const [uploadName, setUploadName] = useState(activeClientName);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const nameOf = (c: CalendarWithPosts) => c.client_name?.trim() || "Sem nome";

  // Agrupa os calendários por cliente (por nome digitado no upload)
  const groups = useMemo(() => {
    const map = new Map<string, CalendarWithPosts[]>();
    for (const c of calendars) {
      const k = nameOf(c);
      (map.get(k) ?? map.set(k, []).get(k)!).push(c);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b, "pt-BR"));
  }, [calendars]);

  const publicUrl = (token: string) =>
    typeof window !== "undefined" ? `${window.location.origin}/cal/${token}` : `/cal/${token}`;

  async function doUpload() {
    const name = uploadName.trim();
    const file = fileRef.current?.files?.[0];
    if (!name) {
      setMsg({ ok: false, text: "Digite o nome do cliente." });
      return;
    }
    if (!file) {
      setMsg({ ok: false, text: "Escolha o PDF da pauta." });
      return;
    }
    setImporting(true);
    setMsg(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("client_name", name);
      const r = await fetch("/api/calendario/import", { method: "POST", body: fd });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        setMsg({ ok: false, text: d.error ?? "Erro ao ler o PDF." });
      } else {
        setMsg({ ok: true, text: `✅ ${d.created} posts lidos — calendário “${d.title}” de ${name} criado.` });
        setOpenId(d.id);
        setShowUpload(false);
        router.refresh();
      }
    } catch (err) {
      setMsg({ ok: false, text: "Erro ao subir: " + (err as Error).message });
    } finally {
      setImporting(false);
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

  async function patch(id: string, body: Record<string, string>) {
    await fetch(`/api/calendario/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => {});
    router.refresh();
  }

  function renameTitle(id: string, current: string) {
    const val = window.prompt("Nome do calendário (ex: Agosto 2026):", current);
    if (val != null && val.trim() && val.trim() !== current) patch(id, { title: val.trim() });
  }
  function editClient(id: string, current: string) {
    const val = window.prompt("Nome do cliente deste calendário:", current === "Sem nome" ? "" : current);
    if (val != null && val.trim() && val.trim() !== current) patch(id, { client_name: val.trim() });
  }
  function editTheme(id: string, current: string) {
    const val = window.prompt("Tema do mês (aparece no topo do calendário):", current);
    if (val != null) patch(id, { theme: val.trim() });
  }

  async function remove(id: string, title: string, client: string) {
    if (!window.confirm(`Excluir o calendário “${title}” de ${client}? Isso apaga a visualização e o link do cliente.`)) return;
    await fetch(`/api/calendario/${id}`, { method: "DELETE" }).catch(() => {});
    if (openId === id) setOpenId(null);
    setMsg({ ok: true, text: "Calendário excluído." });
    router.refresh();
  }

  async function setPostStatus(postId: string, status: CalendarPostStatus) {
    setStatusBusyId(postId);
    try {
      const r = await fetch(`/api/calendario/post/${postId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? "Erro");
      router.refresh();
    } catch (e) {
      setMsg({ ok: false, text: "Não consegui marcar o status: " + (e as Error).message });
    } finally {
      setStatusBusyId(null);
    }
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
            Suba a pauta em PDF de qualquer cliente — <b>conectado no Studio ou não</b> — e ela vira um calendário visual
            pra compartilhar.
          </p>
        </div>
        <button
          onClick={() => {
            setUploadName(activeClientName);
            setShowUpload(true);
          }}
          className="gradient-brand flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition-fluid hover:opacity-95"
        >
          <FileText className="h-4 w-4" /> Subir pauta (PDF)
        </button>
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

      {calendars.length === 0 ? (
        <button
          onClick={() => {
            setUploadName(activeClientName);
            setShowUpload(true);
          }}
          className="flex w-full flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-line bg-canvas p-12 text-center text-muted transition-fluid hover:border-brand-blue/50 hover:text-ink"
        >
          <FileText className="h-8 w-8" />
          <span className="text-sm font-semibold">Suba a primeira pauta em PDF</span>
          <span className="text-xs">Você digita o nome do cliente e eu monto o calendário automaticamente.</span>
        </button>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
          {/* ===== Lista por cliente ===== */}
          <div className="space-y-4">
            {groups.map(([client, cals]) => (
              <div key={client}>
                <p className="mb-1.5 px-1 text-xs font-bold uppercase tracking-wide text-muted">{client}</p>
                <div className="space-y-2">
                  {cals.map((c) => {
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
                            onClick={() => editClient(c.id, client)}
                            className="grid h-6 w-6 place-items-center rounded-lg border border-line text-muted hover:text-ink"
                            title="Corrigir cliente"
                          >
                            <Pencil className="h-3 w-3" />
                          </button>
                          <button
                            onClick={() => remove(c.id, c.title, client)}
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
              </div>
            ))}
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
                    <div>
                      <button onClick={() => renameTitle(opened.id, opened.title)} className="text-left">
                        <h2 className="font-display text-lg font-bold text-ink hover:underline">{opened.title}</h2>
                      </button>
                      <p className="text-xs text-muted">{nameOf(opened)}</p>
                    </div>
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
                <CalendarView
                  theme={opened.theme}
                  posts={opened.posts}
                  editable
                  onSetStatus={setPostStatus}
                  busyId={statusBusyId}
                />
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

      {/* ===== Modal: subir pauta (pede o cliente) ===== */}
      {showUpload && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-3xl bg-surface p-5 shadow-pop">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-lg font-bold text-ink">Subir pauta em PDF</h2>
              <button onClick={() => setShowUpload(false)} className="text-muted hover:text-ink">
                <X className="h-5 w-5" />
              </button>
            </div>

            <label className="mb-1 block text-xs font-semibold text-ink">Cliente dessa pauta</label>
            <input
              value={uploadName}
              onChange={(e) => setUploadName(e.target.value)}
              list="client-suggestions"
              placeholder="Ex: Planserv"
              autoFocus
              className="mb-1 w-full rounded-xl border border-line bg-canvas px-3 py-2.5 text-sm font-semibold text-ink outline-none focus:border-brand-blue"
            />
            <datalist id="client-suggestions">
              {clientSuggestions.map((n) => (
                <option key={n} value={n} />
              ))}
            </datalist>
            <p className="mb-3 text-xs text-muted">Não precisa estar conectado no Studio — é só o nome pra organizar.</p>

            <input ref={fileRef} type="file" accept="application/pdf,.pdf,.md,.markdown,text/markdown,text/plain" className="mb-2 w-full text-sm text-muted file:mr-3 file:rounded-lg file:border-0 file:bg-brand-blue-50 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-brand-blue-700" />
            <p className="mb-4 text-xs text-muted">Aceita <b>PDF</b> ou <b>.md</b> (padrão MarkSeg — leitura garantida).</p>

            <button
              onClick={doUpload}
              disabled={importing}
              className="gradient-brand flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
            >
              {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {importing ? "Lendo PDF…" : "Subir e montar calendário"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
