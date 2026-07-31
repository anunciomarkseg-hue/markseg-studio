"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Share2,
  X,
  Trash2,
  Loader2,
  ImagePlus,
  CalendarClock,
  AlertTriangle,
  MessageSquare,
  Send,
  Copy,
  Check,
  FileText,
} from "lucide-react";
import type { SocialAccount } from "@/lib/types";
import type { Client } from "@/lib/clients";
import type { EditorialPost, ApprovalStatus, ProductionStatus, EditorialFeedback } from "@/lib/editorial";
import { PlatformIcon } from "@/components/PlatformIcon";
import { uploadMediaDirect } from "@/lib/supabase-browser";
import { isSameDay } from "@/lib/format";
import { commemorativesForYear, commemorativesOn } from "@/lib/commemorative";

const WD = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

const APPROVAL: Record<ApprovalStatus, { label: string; chip: string; dot: string }> = {
  rascunho: { label: "Rascunho", chip: "bg-slate-100 text-slate-600", dot: "bg-slate-400" },
  enviado: { label: "Aguardando cliente", chip: "bg-amber-50 text-amber-700", dot: "bg-amber-500" },
  aprovado: { label: "Aprovado", chip: "bg-emerald-50 text-emerald-700", dot: "bg-emerald-500" },
  ajustes: { label: "Pediu ajuste", chip: "bg-rose-50 text-rose-700", dot: "bg-rose-500" },
};
const CARD: Record<ApprovalStatus, string> = {
  rascunho: "border-l-slate-400 bg-slate-50",
  enviado: "border-l-amber-400 bg-amber-50",
  aprovado: "border-l-emerald-500 bg-emerald-50",
  ajustes: "border-l-rose-400 bg-rose-50",
};
const PRODUCTION: Record<ProductionStatus, { label: string; chip: string }> = {
  briefing: { label: "Briefing", chip: "bg-slate-100 text-slate-600" },
  em_producao: { label: "Em produção", chip: "bg-brand-blue-50 text-brand-blue-700" },
  pronto: { label: "Pronto", chip: "bg-emerald-50 text-emerald-700" },
};
const FORMATS: { v: string; l: string }[] = [
  { v: "feed", l: "Estático" },
  { v: "carrossel", l: "Carrossel" },
  { v: "reel", l: "Reel" },
  { v: "story", l: "Story" },
];
const fmtLabel = (v: string) => FORMATS.find((f) => f.v === v)?.l ?? v;

type Draft = {
  id: string | null;
  planned_date: string; // yyyy-mm-dd
  time: string;
  networks: string[];
  format: string;
  title: string;
  caption: string;
  brief: string;
  reference_urls: string[];
  production_status: ProductionStatus;
  approval_status: ApprovalStatus;
  client_feedback: string | null;
  scheduled_post_id: string | null;
};

const isVideoUrl = (u: string) => /\.(mp4|mov|m4v|webm)(\?|$)/i.test(u);
const isVideoFormat = (f: string) => ["reel", "story", "video"].includes(f);

function toDraft(p?: EditorialPost, day?: Date): Draft {
  if (p) {
    const d = new Date(p.planned_date);
    return {
      id: p.id,
      planned_date: d.toISOString().slice(0, 10),
      time: d.toTimeString().slice(0, 5),
      networks: p.networks ?? [],
      format: p.format,
      title: p.title ?? "",
      caption: p.caption,
      brief: p.brief,
      reference_urls: p.reference_urls ?? [],
      production_status: p.production_status,
      approval_status: p.approval_status,
      client_feedback: p.client_feedback,
      scheduled_post_id: p.scheduled_post_id,
    };
  }
  const base = day ?? new Date();
  return {
    id: null,
    planned_date: base.toISOString().slice(0, 10),
    time: "10:00",
    networks: [],
    format: "feed",
    title: "",
    caption: "",
    brief: "",
    reference_urls: [],
    production_status: "briefing",
    approval_status: "rascunho",
    client_feedback: null,
    scheduled_post_id: null,
  };
}

export function PautaClient({
  accounts,
  activeGroup,
  clients,
  posts,
  pending,
  ajustes,
  themes,
}: {
  accounts: SocialAccount[];
  activeGroup: string | null;
  clients: Client[];
  posts: EditorialPost[];
  pending: EditorialPost[];
  ajustes: EditorialPost[];
  themes: Record<string, string>;
}) {
  const router = useRouter();
  const today = new Date();
  const [view, setView] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [themeMap, setThemeMap] = useState<Record<string, string>>(themes);
  const [editingTheme, setEditingTheme] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [feedbackList, setFeedbackList] = useState<EditorialFeedback[]>([]);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // busca os comentários (ajustes/aprovações) do post aberto
  useEffect(() => {
    if (!draft?.id) {
      setFeedbackList([]);
      return;
    }
    let alive = true;
    fetch(`/api/editorial/${draft.id}/feedback`)
      .then((r) => r.json())
      .then((d) => {
        if (alive) setFeedbackList(d.feedback ?? []);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [draft?.id]);

  const activeClient = clients.find((c) => c.key === activeGroup) ?? null;
  const clientPlatforms = useMemo(
    () => [...new Set((activeClient?.accounts ?? []).map((a) => a.platform))],
    [activeClient],
  );
  const nameOf = (g: string) => clients.find((c) => c.key === g)?.name ?? "Cliente";

  const cells = useMemo(() => {
    const y = view.getFullYear();
    const m = view.getMonth();
    const first = new Date(y, m, 1).getDay();
    const days = new Date(y, m + 1, 0).getDate();
    const out: (Date | null)[] = [];
    for (let i = 0; i < first; i++) out.push(null);
    for (let d = 1; d <= days; d++) out.push(new Date(y, m, d));
    while (out.length % 7 !== 0) out.push(null);
    return out;
  }, [view]);

  const monthLabel = view.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  const dayPosts = (d: Date) => posts.filter((p) => isSameDay(new Date(p.planned_date), d));

  const agenda = useMemo(
    () =>
      (cells.filter(Boolean) as Date[])
        .map((d) => ({ date: d, items: dayPosts(d) }))
        .filter((x) => x.items.length > 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cells, posts],
  );

  const ym = `${view.getFullYear()}-${String(view.getMonth() + 1).padStart(2, "0")}`;
  const monthTheme = themeMap[ym] ?? "";

  // datas comemorativas do Brasil
  const comemos = useMemo(() => commemorativesForYear(view.getFullYear()), [view]);
  const monthComemos = useMemo(() => {
    const y = view.getFullYear();
    const m = view.getMonth();
    const days = new Date(y, m + 1, 0).getDate();
    const list: { day: number; name: string }[] = [];
    for (let d = 1; d <= days; d++) {
      commemorativesOn(comemos, new Date(y, m, d)).forEach((name) => list.push({ day: d, name }));
    }
    return list;
  }, [comemos, view]);

  // POST 1, 2, 3… em ordem cronológica dentro do mês
  const numberOf = useMemo(() => {
    const inMonth = posts
      .filter((p) => {
        const d = new Date(p.planned_date);
        return d.getFullYear() === view.getFullYear() && d.getMonth() === view.getMonth();
      })
      .sort((a, b) => +new Date(a.planned_date) - +new Date(b.planned_date));
    const m: Record<string, number> = {};
    inMonth.forEach((p, i) => (m[p.id] = i + 1));
    return m;
  }, [posts, view]);

  async function saveTheme(value: string) {
    setEditingTheme(false);
    if (!activeGroup) return;
    setThemeMap((t) => ({ ...t, [ym]: value }));
    await fetch("/api/editorial/theme", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ group_key: activeGroup, ym, theme: value }),
    }).catch(() => {});
  }

  function openNew(day?: Date) {
    if (!activeGroup) {
      setMsg({ ok: false, text: "Escolha um cliente no topo pra montar a pauta dele." });
      return;
    }
    setDraft(toDraft(undefined, day));
  }

  async function onRef(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length || !draft) return;
    setUploading(true);
    try {
      if (draft.format === "carrossel") {
        // carrossel = várias imagens (acumula, até 10)
        const imgs = files.filter((f) => !f.type.startsWith("video"));
        const urls: string[] = [];
        for (const f of imgs) urls.push((await uploadMediaDirect(f)).url);
        setDraft({ ...draft, reference_urls: [...draft.reference_urls, ...urls].slice(0, 10) });
      } else {
        // feed = 1 imagem; reel/story = 1 vídeo
        const data = await uploadMediaDirect(files[0]);
        setDraft({ ...draft, reference_urls: [data.url] });
      }
    } catch (err) {
      setMsg({ ok: false, text: (err as Error).message });
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    if (!draft || !activeGroup) return;
    setBusy(true);
    setMsg(null);
    try {
      const planned_date = new Date(`${draft.planned_date}T${draft.time}`).toISOString();
      const payload = {
        planned_date,
        networks: draft.networks,
        format: draft.format,
        title: draft.title,
        caption: draft.caption,
        brief: draft.brief,
        reference_urls: draft.reference_urls,
        production_status: draft.production_status,
      };
      const res = draft.id
        ? await fetch(`/api/editorial/${draft.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetch("/api/editorial", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...payload, group_key: activeGroup }),
          });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Erro ao salvar");
      setDraft(null);
      setMsg({ ok: true, text: "Pauta salva. ✅" });
      router.refresh();
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  async function setApproval(status: ApprovalStatus) {
    if (!draft?.id) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/editorial/${draft.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approval_status: status }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Erro");
      setDraft({ ...draft, approval_status: status });
      router.refresh();
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  async function del() {
    if (!draft?.id || !window.confirm("Excluir esse item da pauta?")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/editorial/${draft.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json()).error ?? "Erro");
      setDraft(null);
      setMsg({ ok: true, text: "Item removido." });
      router.refresh();
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  const pdfInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  async function importPdf(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await fetch("/api/editorial/import", { method: "POST", body: fd });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        window.alert(d.error ?? "Erro ao importar o PDF.");
      } else if (d.created === 0 && d.skipped > 0) {
        window.alert(`Esses ${d.skipped} posts já estavam na pauta — nada novo pra importar. ✅`);
      } else {
        window.alert(
          `✅ ${d.created} posts importados${d.skipped ? ` (${d.skipped} já existiam)` : ""}!\nConfira as datas/formatos e ajuste o que precisar antes de mandar pro cliente aprovar.`,
        );
        router.refresh();
      }
    } catch (err) {
      window.alert("Erro ao importar: " + (err as Error).message);
    } finally {
      setImporting(false);
      if (pdfInputRef.current) pdfInputRef.current.value = "";
    }
  }

  async function share() {
    if (!activeGroup) {
      setMsg({ ok: false, text: "Escolha um cliente no topo primeiro." });
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/editorial/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ group_key: activeGroup }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro");
      setShareLink(`${window.location.origin}/aprovar/${data.token}`);
      if (data.sent > 0) {
        setMsg({ ok: true, text: `${data.sent} post(s) enviado(s) pro cliente aprovar. ✅` });
        router.refresh();
      }
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  function scheduleFromPauta(p: EditorialPost) {
    // handoff pro composer (ele lê no /publicar e preenche)
    sessionStorage.setItem(
      "pauta_prefill",
      JSON.stringify({
        editorialId: p.id,
        group: p.group_key,
        caption: p.caption,
        format: p.format,
        networks: p.networks,
        date: p.planned_date,
      }),
    );
    router.push("/publicar");
  }

  return (
    <div className="mx-auto max-w-6xl">
      {/* ===== ALERTA: ajustes pedidos pelo cliente ===== */}
      {ajustes.length > 0 && (
        <div className="mb-5 rounded-2xl border border-rose-300 bg-rose-50 p-4 animate-rise">
          <div className="flex items-start gap-3">
            <MessageSquare className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-rose-900">
                {ajustes.length} post{ajustes.length > 1 ? "s" : ""} com ajuste pedido pelo cliente
              </p>
              <div className="mt-2 space-y-1.5">
                {ajustes.slice(0, 6).map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setDraft(toDraft(p))}
                    className="flex w-full items-center gap-2 text-left text-xs"
                  >
                    <span className="shrink-0 font-semibold text-rose-700">
                      {new Date(p.planned_date).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
                    </span>
                    <span className="font-medium text-ink">{nameOf(p.group_key)}</span>
                    <span className="min-w-0 flex-1 truncate text-muted">
                      {p.title || p.caption || "(post)"}
                    </span>
                    <span className="shrink-0 font-semibold text-rose-600 hover:underline">ver ajuste</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== ALERTA GERAL: precisa agendar ===== */}
      {pending.length > 0 && (
        <div className="mb-5 rounded-2xl border border-amber-300 bg-amber-50 p-4 animate-rise">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-amber-900">
                {pending.length} post{pending.length > 1 ? "s" : ""} aprovado{pending.length > 1 ? "s" : ""} precisa
                {pending.length > 1 ? "m" : ""} ser agendado{pending.length > 1 ? "s" : ""}
              </p>
              <div className="mt-2 space-y-1.5">
                {pending.slice(0, 6).map((p) => {
                  const late = new Date(p.planned_date) < today;
                  return (
                    <div key={p.id} className="flex items-center gap-2 text-xs">
                      <span className={`shrink-0 font-semibold ${late ? "text-rose-600" : "text-amber-800"}`}>
                        {new Date(p.planned_date).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
                        {late ? " (atrasado)" : ""}
                      </span>
                      <span className="font-medium text-ink">{nameOf(p.group_key)}</span>
                      <span className="min-w-0 flex-1 truncate text-muted">{p.caption || "(sem legenda)"}</span>
                      <button
                        onClick={() => scheduleFromPauta(p)}
                        className="shrink-0 rounded-lg bg-amber-600 px-2.5 py-1 font-semibold text-white transition-fluid hover:bg-amber-700"
                      >
                        Agendar
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== Cabeçalho ===== */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 animate-rise">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink">Pauta</h1>
          <p className="mt-1 text-sm text-muted">
            {activeClient ? (
              <>
                Cronograma editorial de <span className="font-semibold text-ink">{activeClient.name}</span> ·{" "}
                <span className="capitalize">{monthLabel}</span>
              </>
            ) : (
              "Escolha um cliente no topo pra montar a pauta dele."
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setView((v) => new Date(v.getFullYear(), v.getMonth() - 1, 1))}
            className="grid h-9 w-9 place-items-center rounded-lg border border-line bg-surface text-muted hover:text-ink"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => setView(new Date(today.getFullYear(), today.getMonth(), 1))}
            className="rounded-lg border border-line bg-surface px-3 py-2 text-sm font-semibold text-ink hover:bg-canvas"
          >
            Hoje
          </button>
          <button
            onClick={() => setView((v) => new Date(v.getFullYear(), v.getMonth() + 1, 1))}
            className="grid h-9 w-9 place-items-center rounded-lg border border-line bg-surface text-muted hover:text-ink"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          {activeClient && (
            <>
              <input ref={pdfInputRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={importPdf} />
              <button
                onClick={() => pdfInputRef.current?.click()}
                disabled={importing}
                title="Importar uma pauta em PDF (modelo MarkSeg) e distribuir no calendário"
                className="flex items-center gap-1.5 rounded-lg border border-brand-orange bg-orange-50 px-3 py-2 text-sm font-semibold text-brand-orange transition-fluid hover:bg-orange-100 disabled:opacity-60"
              >
                {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                <span className="hidden sm:inline">{importing ? "Lendo PDF…" : "Importar PDF"}</span>
              </button>
              <button
                onClick={share}
                disabled={busy}
                className="flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-2 text-sm font-semibold text-ink hover:bg-canvas"
              >
                <Share2 className="h-4 w-4" /> <span className="hidden sm:inline">Compartilhar</span>
              </button>
              <button
                onClick={() => openNew()}
                className="gradient-brand flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-white hover:opacity-95"
              >
                <Plus className="h-4 w-4" strokeWidth={2.6} /> <span className="hidden sm:inline">Novo post</span>
              </button>
            </>
          )}
        </div>
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

      {shareLink && (
        <div className="mb-4 rounded-2xl border border-brand-blue/30 bg-brand-blue-50/50 p-4">
          <p className="mb-2 text-sm font-semibold text-brand-blue-700">
            Link de aprovação do cliente (ele aprova/comenta sem login):
          </p>
          <div className="flex items-center gap-2">
            <input
              readOnly
              value={shareLink}
              className="min-w-0 flex-1 rounded-lg border border-line bg-white px-3 py-2 text-xs text-ink"
            />
            <button
              onClick={() => {
                navigator.clipboard.writeText(shareLink);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
              className="flex shrink-0 items-center gap-1.5 rounded-lg bg-brand-blue px-3 py-2 text-xs font-semibold text-white"
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Copiado" : "Copiar"}
            </button>
          </div>
        </div>
      )}

      {!activeClient ? (
        <div className="card grid place-items-center gap-2 p-12 text-center text-sm text-muted">
          <CalendarClock className="h-7 w-7" />
          Selecione um cliente no seletor do topo pra ver e montar a pauta dele.
        </div>
      ) : (
        <>
          {/* ===== MOBILE: mini-grade + agenda ===== */}
          <div className="md:hidden">
            {editingTheme ? (
              <input
                autoFocus
                defaultValue={monthTheme}
                onBlur={(e) => saveTheme(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveTheme((e.target as HTMLInputElement).value);
                }}
                placeholder="Tema do mês…"
                className="mb-3 w-full rounded-xl bg-brand-blue-700 px-3 py-2.5 text-xs font-bold uppercase tracking-wide text-white outline-none placeholder:text-white/50"
              />
            ) : (
              <button
                onClick={() => setEditingTheme(true)}
                className="mb-3 flex w-full items-center gap-2 rounded-xl bg-brand-blue-700 px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wide text-white"
              >
                <span className="h-2 w-2 shrink-0 rounded-full bg-brand-amber" />
                {monthTheme ? <>Tema · {monthTheme}</> : <span className="text-white/70">Tema do mês · definir</span>}
              </button>
            )}
            <div className="card p-3">
              <div className="grid grid-cols-7 border-b border-line pb-2 text-center text-[11px] font-semibold text-muted">
                {WD.map((d) => (
                  <div key={d}>{d.slice(0, 1)}</div>
                ))}
              </div>
              <div className="grid grid-cols-7">
                {cells.map((date, i) => {
                  if (!date) return <div key={i} className="h-11" />;
                  const items = dayPosts(date);
                  const isToday = isSameDay(date, today);
                  return (
                    <button
                      key={i}
                      onClick={() => (items.length ? setDraft(toDraft(items[0])) : openNew(date))}
                      className="flex h-11 flex-col items-center justify-center gap-0.5"
                    >
                      <span
                        className={`grid h-6 w-6 place-items-center rounded-full text-xs font-semibold ${
                          isToday ? "gradient-brand text-white" : "text-ink"
                        }`}
                      >
                        {date.getDate()}
                      </span>
                      <span className="flex h-1.5 items-center gap-0.5">
                        {items.slice(0, 3).map((p) => (
                          <span key={p.id} className={`h-1.5 w-1.5 rounded-full ${APPROVAL[p.approval_status].dot}`} />
                        ))}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
            {monthComemos.length > 0 && (
              <div className="card mt-4 p-3">
                <p className="mb-2 text-xs font-bold uppercase text-muted">Datas comemorativas do mês</p>
                <div className="flex flex-wrap gap-1.5">
                  {monthComemos.map((c, i) => (
                    <span
                      key={i}
                      className="rounded-md bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700"
                    >
                      {c.day} · {c.name}
                    </span>
                  ))}
                </div>
              </div>
            )}
            <div className="mt-4 space-y-3">
              {agenda.length === 0 ? (
                <div className="card p-8 text-center text-sm text-muted">
                  Nenhum post na pauta desse mês. Toque em <b>Novo post</b>.
                </div>
              ) : (
                agenda.map(({ date, items }) => (
                  <div key={date.toISOString()} className="card p-3">
                    <p className="mb-2 text-xs font-bold uppercase text-muted">
                      {date.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "short" })}
                    </p>
                    <div className="space-y-2">
                      {items.map((p) => (
                        <ItemChip key={p.id} p={p} onClick={() => setDraft(toDraft(p))} />
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* ===== DESKTOP: cronograma editorial ===== */}
          <div className="card hidden overflow-hidden md:block">
            <div className="grid grid-cols-7">
              {/* cabeçalho navy */}
              {WD.map((d) => (
                <div
                  key={d}
                  className="bg-[#22315f] px-3 py-2.5 text-[11px] font-bold uppercase tracking-wider text-white/85"
                >
                  {d}
                </div>
              ))}

              {/* banner TEMA DO MÊS */}
              {editingTheme ? (
                <input
                  autoFocus
                  defaultValue={monthTheme}
                  onBlur={(e) => saveTheme(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveTheme((e.target as HTMLInputElement).value);
                    if (e.key === "Escape") setEditingTheme(false);
                  }}
                  placeholder="TEMA DO MÊS · ex: Vitrine de Soluções · uma solução por post"
                  className="col-span-7 bg-brand-blue-700 px-4 py-2.5 text-sm font-bold uppercase tracking-wide text-white outline-none placeholder:text-white/50"
                />
              ) : (
                <button
                  onClick={() => setEditingTheme(true)}
                  className="col-span-7 flex items-center gap-2 bg-brand-blue-700 px-4 py-2.5 text-left text-sm font-bold uppercase tracking-wide text-white transition-fluid hover:brightness-110"
                >
                  <span className="h-2 w-2 shrink-0 rounded-full bg-brand-amber" />
                  {monthTheme ? (
                    <>
                      Tema do mês · <span className="font-extrabold">{monthTheme}</span>
                    </>
                  ) : (
                    <span className="text-white/70">Tema do mês · clique pra definir</span>
                  )}
                </button>
              )}

              {/* células */}
              {cells.map((date, i) => {
                if (!date)
                  return <div key={i} className="min-h-32 border-b border-r border-line/60 bg-canvas/40" />;
                const items = dayPosts(date);
                const isToday = isSameDay(date, today);
                return (
                  <div key={i} className="group min-h-32 border-b border-r border-line/60 p-1.5">
                    <div className="mb-1 flex items-center justify-between">
                      <span
                        className={`inline-grid h-6 w-6 place-items-center rounded-full text-xs font-bold ${
                          isToday ? "gradient-brand text-white" : "text-slate-400"
                        }`}
                      >
                        {date.getDate()}
                      </span>
                      <button
                        onClick={() => openNew(date)}
                        className="hidden h-5 w-5 place-items-center rounded-md text-muted hover:bg-canvas hover:text-ink group-hover:grid"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    {commemorativesOn(comemos, date)
                      .slice(0, 1)
                      .map((name) => (
                        <div
                          key={name}
                          title={name}
                          className="mb-1 truncate rounded bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-700"
                        >
                          {name}
                        </div>
                      ))}
                    <div className="space-y-1.5">
                      {items.map((p) => (
                        <button
                          key={p.id}
                          onClick={() => setDraft(toDraft(p))}
                          className={`block w-full rounded-r-md border-l-[3px] px-2 py-1.5 text-left transition-fluid hover:brightness-95 ${CARD[p.approval_status]}`}
                        >
                          <p className="text-[9px] font-bold uppercase tracking-wide text-slate-500">
                            Post {numberOf[p.id] ?? "•"}
                          </p>
                          <p className="text-xs font-extrabold text-ink">{fmtLabel(p.format)}</p>
                          {p.title && (
                            <p className="mt-0.5 text-[11px] leading-tight text-slate-600 line-clamp-2">{p.title}</p>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* ===== MODAL DE EDIÇÃO ===== */}
      {draft && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
          <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-surface p-5 shadow-pop sm:rounded-3xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-lg font-bold text-ink">
                {draft.id ? "Editar post da pauta" : "Novo post na pauta"}
              </h2>
              <button onClick={() => setDraft(null)} className="text-muted hover:text-ink">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* status atual */}
            {draft.id && (
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${APPROVAL[draft.approval_status].chip}`}>
                  {APPROVAL[draft.approval_status].label}
                </span>
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${PRODUCTION[draft.production_status].chip}`}>
                  {PRODUCTION[draft.production_status].label}
                </span>
              </div>
            )}

            {feedbackList.length > 0 && (
              <div className="mb-4 space-y-2">
                <p className="text-xs font-bold uppercase text-muted">
                  Respostas do cliente ({feedbackList.length})
                </p>
                {feedbackList.map((f) => (
                  <div
                    key={f.id}
                    className={`rounded-xl border p-3 text-sm ${
                      f.action === "aprovado"
                        ? "border-emerald-200 bg-emerald-50"
                        : "border-rose-200 bg-rose-50"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-ink">
                        {f.author || "Cliente"} {f.action === "aprovado" ? "· aprovou ✓" : "· pediu ajuste"}
                      </span>
                      <span className="text-[10px] text-muted">
                        {new Date(f.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
                      </span>
                    </div>
                    {f.message && (
                      <p className={`mt-1 ${f.action === "aprovado" ? "text-emerald-800" : "text-rose-700"}`}>
                        {f.message}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* data + hora */}
            <div className="mb-3 flex gap-2">
              <input
                type="date"
                value={draft.planned_date}
                onChange={(e) => setDraft({ ...draft, planned_date: e.target.value })}
                className="flex-1 rounded-xl border border-line bg-canvas px-3 py-2.5 text-sm text-ink outline-none focus:border-brand-blue"
              />
              <input
                type="time"
                value={draft.time}
                onChange={(e) => setDraft({ ...draft, time: e.target.value })}
                className="rounded-xl border border-line bg-canvas px-3 py-2.5 text-sm text-ink outline-none focus:border-brand-blue"
              />
            </div>

            {/* redes */}
            {clientPlatforms.length > 0 && (
              <div className="mb-3 flex flex-wrap gap-2">
                {clientPlatforms.map((pl) => {
                  const on = draft.networks.includes(pl);
                  return (
                    <button
                      key={pl}
                      onClick={() =>
                        setDraft({
                          ...draft,
                          networks: on ? draft.networks.filter((n) => n !== pl) : [...draft.networks, pl],
                        })
                      }
                      className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-semibold capitalize transition-fluid ${
                        on ? "border-brand-blue bg-brand-blue-50 text-brand-blue-700" : "border-line text-muted"
                      }`}
                    >
                      <PlatformIcon platform={pl} className="h-4 w-4" /> {pl}
                    </button>
                  );
                })}
              </div>
            )}

            {/* formato */}
            <div className="mb-3 flex flex-wrap gap-2">
              {FORMATS.map((f) => (
                <button
                  key={f.v}
                  onClick={() => setDraft({ ...draft, format: f.v })}
                  className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition-fluid ${
                    draft.format === f.v ? "gradient-brand text-white" : "bg-canvas text-muted hover:text-ink"
                  }`}
                >
                  {f.l}
                </button>
              ))}
            </div>

            {/* título / tema curto (aparece no card) */}
            <input
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              placeholder="Tema do post (ex: Detecção de Humano)"
              className="mb-3 w-full rounded-xl border border-line bg-canvas px-3 py-2.5 text-sm font-semibold text-ink outline-none focus:border-brand-blue"
            />

            {/* legenda */}
            <textarea
              value={draft.caption}
              onChange={(e) => setDraft({ ...draft, caption: e.target.value })}
              placeholder="Legenda / copy do post…"
              className="mb-3 h-24 w-full resize-none rounded-xl border border-line bg-canvas p-3 text-sm text-ink outline-none focus:border-brand-blue"
            />

            {/* briefing */}
            <textarea
              value={draft.brief}
              onChange={(e) => setDraft({ ...draft, brief: e.target.value })}
              placeholder="Briefing do criativo (o que o designer/videomaker deve fazer)…"
              className="mb-3 h-20 w-full resize-none rounded-xl border border-line bg-canvas p-3 text-sm text-ink outline-none focus:border-brand-blue"
            />

            {/* mídia de referência — acompanha o formato */}
            <label className="mb-1 block text-xs font-semibold text-ink">
              {draft.format === "carrossel"
                ? "Imagens de referência (carrossel)"
                : isVideoFormat(draft.format)
                  ? "Vídeo de referência"
                  : "Imagem / mockup de referência"}
            </label>
            <div className="mb-3">
              {draft.reference_urls.length > 0 ? (
                draft.format === "carrossel" ? (
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                    {draft.reference_urls.map((url, i) => (
                      <div key={url} className="group relative aspect-square">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={url} alt={`ref ${i + 1}`} className="h-full w-full rounded-lg object-cover" />
                        <span className="absolute left-1 top-1 grid h-4 w-4 place-items-center rounded bg-ink/70 text-[9px] font-bold text-white">
                          {i + 1}
                        </span>
                        <button
                          onClick={() =>
                            setDraft({ ...draft, reference_urls: draft.reference_urls.filter((_, j) => j !== i) })
                          }
                          className="absolute right-1 top-1 grid h-4 w-4 place-items-center rounded bg-rose-600 text-white opacity-100 transition-fluid sm:opacity-0 sm:group-hover:opacity-100"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                    {draft.reference_urls.length < 10 && (
                      <label className="grid aspect-square cursor-pointer place-items-center rounded-lg border border-dashed border-slate-300 bg-canvas text-muted hover:border-brand-blue">
                        <input type="file" accept="image/*" multiple className="hidden" onChange={onRef} />
                        {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                      </label>
                    )}
                  </div>
                ) : isVideoUrl(draft.reference_urls[0]) ? (
                  <div className="flex items-center gap-3 rounded-xl border border-line bg-canvas p-2">
                    <video src={draft.reference_urls[0]} className="h-16 w-16 rounded-lg object-cover" muted playsInline />
                    <span className="flex-1 text-xs font-medium text-ink">Vídeo anexado ✓</span>
                    <button
                      onClick={() => setDraft({ ...draft, reference_urls: [] })}
                      className="text-xs font-semibold text-rose-600 hover:underline"
                    >
                      Remover
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-3 rounded-xl border border-line bg-canvas p-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={draft.reference_urls[0]} alt="referência" className="h-16 w-16 rounded-lg object-cover" />
                    <span className="flex-1 text-xs font-medium text-ink">Referência anexada ✓</span>
                    <button
                      onClick={() => setDraft({ ...draft, reference_urls: [] })}
                      className="text-xs font-semibold text-rose-600 hover:underline"
                    >
                      Remover
                    </button>
                  </div>
                )
              ) : (
                <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-slate-300 bg-canvas p-3 text-sm text-muted hover:border-brand-blue">
                  <input
                    type="file"
                    accept={isVideoFormat(draft.format) ? "video/*" : "image/*"}
                    multiple={draft.format === "carrossel"}
                    className="hidden"
                    onChange={onRef}
                  />
                  {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImagePlus className="h-5 w-5" />}
                  {uploading
                    ? "Enviando…"
                    : draft.format === "carrossel"
                      ? "Anexar imagens (pode várias)"
                      : isVideoFormat(draft.format)
                        ? "Anexar vídeo de referência"
                        : "Anexar imagem de referência"}
                </label>
              )}
            </div>

            {/* status de produção */}
            <label className="mb-1 block text-xs font-semibold text-ink">Status de produção</label>
            <div className="mb-4 flex flex-wrap gap-2">
              {(Object.keys(PRODUCTION) as ProductionStatus[]).map((s) => (
                <button
                  key={s}
                  onClick={() => setDraft({ ...draft, production_status: s })}
                  className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition-fluid ${
                    draft.production_status === s ? "bg-ink text-white" : "bg-canvas text-muted hover:text-ink"
                  }`}
                >
                  {PRODUCTION[s].label}
                </button>
              ))}
            </div>

            {/* aprovação interna (marcar manualmente) + enviar pro cliente */}
            {draft.id && (
              <div className="mb-4 flex flex-wrap gap-2 border-t border-line pt-3">
                <button
                  onClick={() => setApproval("enviado")}
                  disabled={busy}
                  className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700"
                >
                  Marcar “enviado pro cliente”
                </button>
                <button
                  onClick={() => setApproval("aprovado")}
                  disabled={busy}
                  className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700"
                >
                  Marcar aprovado
                </button>
                {draft.approval_status === "aprovado" && !draft.scheduled_post_id && (
                  <button
                    onClick={() => {
                      const p = posts.find((x) => x.id === draft.id);
                      if (p) scheduleFromPauta(p);
                    }}
                    className="flex items-center gap-1.5 rounded-lg bg-brand-blue px-3 py-1.5 text-xs font-semibold text-white"
                  >
                    <Send className="h-3.5 w-3.5" /> Agendar agora
                  </button>
                )}
              </div>
            )}

            {/* ações */}
            <div className="flex items-center gap-2">
              <button
                onClick={save}
                disabled={busy}
                className="gradient-brand flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {draft.id ? "Salvar alterações" : "Adicionar à pauta"}
              </button>
              {draft.id && (
                <button
                  onClick={del}
                  disabled={busy}
                  className="grid h-11 w-11 place-items-center rounded-xl border border-line text-rose-600 hover:bg-rose-50"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ItemChip({ p, onClick }: { p: EditorialPost; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-2.5 rounded-xl border border-line p-2.5 text-left"
    >
      <span className="flex shrink-0 items-center gap-1">
        {(p.networks ?? []).slice(0, 2).map((n) => (
          <PlatformIcon key={n} platform={n as never} className="h-3.5 w-3.5 text-muted" />
        ))}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs font-semibold text-ink">
          {p.title || p.caption || fmtLabel(p.format)}
        </span>
        <span className="text-[10px] text-muted">
          {new Date(p.planned_date).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} ·{" "}
          {fmtLabel(p.format)}
        </span>
      </span>
      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${APPROVAL[p.approval_status].chip}`}>
        {APPROVAL[p.approval_status].label}
      </span>
    </button>
  );
}
