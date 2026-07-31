"use client";

import { useState } from "react";
import Image from "next/image";
import { ThumbsUp, MessageSquare, Loader2, Check, X, Pencil } from "lucide-react";
import type { EditorialPost, EditorialFeedback } from "@/lib/editorial";

/** Cor + rótulo por formato (igual ao clima do print da pauta). */
const FMT: Record<string, { bg: string; label: string }> = {
  feed: { bg: "#15a06b", label: "Estático" },
  carrossel: { bg: "#f26a2c", label: "Carrossel" },
  reel: { bg: "#1c6fce", label: "Vídeo" },
  story: { bg: "#8B5CF6", label: "Story" },
};

const BADGE: Record<string, { label: string; cls: string }> = {
  rascunho: { label: "Rascunho", cls: "bg-slate-100 text-slate-600" },
  enviado: { label: "Aguardando você", cls: "bg-amber-100 text-amber-800" },
  aprovado: { label: "Aprovado ✓", cls: "bg-emerald-100 text-emerald-800" },
  ajustes: { label: "Ajuste pedido", cls: "bg-rose-100 text-rose-800" },
};

/** Rótulos comuns de briefing criativo — viram título em negrito numa linha própria. */
const SECTIONS = [
  "Formato",
  "Objetivo",
  "Dor",
  "Solução",
  "Solucao",
  "Referência",
  "Referencia",
  "Slides",
  "Paleta",
  "Capa",
  "Legenda",
  "CTA",
  "Abordagem",
  "Gancho",
];

function cleanBrief(raw: string): string {
  return raw
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    // remove lixo de gradinha de calendário no fim: (Seg)(Qua)(Sex)…
    .replace(/(\s*\((seg|ter|qua|qui|sex|s[áa]b|dom)[a-zç]*\))+\s*$/gi, "")
    .trim();
}

function titleCase(l: string): string {
  return l.length <= 3 ? l.toUpperCase() : l.charAt(0).toUpperCase() + l.slice(1).toLowerCase();
}

/** "1 capa, 2 novo estatuto, 3 …" → ["capa", "novo estatuto", …] (ou null se não parecer lista). */
function splitSlides(body: string): string[] | null {
  const parts = body
    .split(/,?\s*(?=\d+\s+\S)/)
    .map((s) => s.replace(/^\d+[\s.)-]*/, "").trim())
    .filter(Boolean);
  return parts.length >= 2 ? parts : null;
}

/** Dá hierarquia à descrição: destaca rótulos, transforma slides em lista, separa em blocos. */
function FormattedBrief({ text }: { text: string }) {
  const clean = cleanBrief(text);
  let blocks: { label: string | null; body: string }[] = [];
  try {
    const re = new RegExp(`(?:^|[.)]\\s+)(${SECTIONS.join("|")})\\b`, "gi");
    const hits: { start: number; end: number; label: string }[] = [];
    let m: RegExpExecArray | null;
    while ((m = re.exec(clean))) {
      const label = m[1];
      hits.push({ start: m.index + (m[0].length - label.length), end: re.lastIndex, label });
    }
    if (hits.length === 0) {
      return <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted">{clean}</p>;
    }
    if (hits[0].start > 0) blocks.push({ label: null, body: clean.slice(0, hits[0].start).trim() });
    hits.forEach((h, i) => {
      const bodyEnd = i + 1 < hits.length ? hits[i + 1].start : clean.length;
      const body = clean
        .slice(h.end, bodyEnd)
        .replace(/^[\s:–—-]+/, "")
        .trim();
      blocks.push({ label: h.label, body });
    });
  } catch {
    return <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted">{clean}</p>;
  }

  return (
    <div className="space-y-2 text-sm leading-relaxed text-muted">
      {blocks.map((b, i) => {
        const slides = b.label && /slides?/i.test(b.label) ? splitSlides(b.body) : null;
        return (
          <div key={i}>
            {b.label && <span className="font-bold text-ink">{titleCase(b.label)}: </span>}
            {slides ? (
              <ul className="mt-1 space-y-1">
                {slides.map((s, j) => (
                  <li key={j} className="flex gap-2">
                    <span className="font-bold text-brand-blue">{j + 1}.</span>
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <span className="whitespace-pre-wrap">{b.body}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function PublicPautaClient({
  token,
  clientName,
  posts,
  feedbackMap,
}: {
  token: string;
  clientName: string;
  handle: string;
  posts: EditorialPost[];
  feedbackMap: Record<string, EditorialFeedback[]>;
}) {
  const [items, setItems] = useState(posts);
  const [fbMap, setFbMap] = useState(feedbackMap);
  const [reviewer, setReviewer] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [openFor, setOpenFor] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [openDesc, setOpenDesc] = useState<Record<string, boolean>>({});
  const [longDesc, setLongDesc] = useState<Record<string, boolean>>({});
  // Mede se a descrição realmente transborda (aí mostra o "Ler mais"). Confiável.
  const measureDesc = (id: string) => (el: HTMLDivElement | null) => {
    if (el && !openDesc[id]) {
      const over = el.scrollHeight > el.clientHeight + 4;
      setLongDesc((s) => (s[id] === over ? s : { ...s, [id]: over }));
    }
  };

  const named = reviewer.trim().length > 0;

  async function act(postId: string, action: "aprovado" | "ajustes", feedback?: string) {
    if (!named) return;
    setBusy(postId);
    try {
      const res = await fetch("/api/aprovar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, postId, action, feedback, author: reviewer.trim() }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Erro");
      setItems((prev) => prev.map((p) => (p.id === postId ? { ...p, approval_status: action } : p)));
      if (action === "ajustes" || feedback?.trim()) {
        const novo: EditorialFeedback = {
          id: `local-${postId}-${(fbMap[postId]?.length ?? 0) + 1}`,
          post_id: postId,
          author: reviewer.trim(),
          message: feedback?.trim() || "",
          action,
          created_at: new Date().toISOString(),
        };
        setFbMap((prev) => ({ ...prev, [postId]: [...(prev[postId] ?? []), novo] }));
      }
      setOpenFor(null);
      setText("");
    } catch {
      /* silencioso */
    } finally {
      setBusy(null);
    }
  }

  const pendingCount = items.filter((p) => p.approval_status === "enviado").length;

  return (
    <div className="min-h-screen bg-canvas">
      <div className="mx-auto max-w-3xl px-4 py-6 sm:py-8">
        {/* Cabeçalho */}
        <div className="card mb-5 border-t-4 border-brand-blue p-5">
          <Image src="/brand/markseg-logo.png" alt="MarkSeg" width={104} height={30} className="mb-3" priority />
          <p className="text-xs font-bold uppercase tracking-wide text-brand-orange">Aprovação de pauta</p>
          <h1 className="mt-1 text-2xl font-bold text-ink">{clientName}</h1>
          <p className="mt-1 text-sm text-muted">
            Aprove os <b>assuntos</b>, <b>formatos</b> e <b>datas</b> do mês. Toque em <b>Aprovar</b> ou{" "}
            <b>Reprovar</b> (aí você escreve a correção).
            {pendingCount > 0 ? ` ${pendingCount} aguardando você.` : " Tudo revisado 🎉"}
          </p>
          <input
            value={reviewer}
            onChange={(e) => setReviewer(e.target.value)}
            placeholder="Seu nome *"
            className={`mt-3 w-full rounded-xl border bg-canvas px-3 py-2.5 text-sm text-ink outline-none focus:bg-white ${
              named ? "border-line focus:border-brand-blue" : "border-amber-300 focus:border-amber-400"
            }`}
          />
          <p className="mt-1.5 text-xs text-muted">
            {named
              ? `✅ Seus apontamentos vão identificados como ${reviewer.trim()}.`
              : "⚠️ Coloque seu nome pra aprovar ou reprovar — cada apontamento fica registrado com quem fez."}
          </p>
        </div>

        {items.length === 0 ? (
          <div className="card grid place-items-center p-12 text-center text-sm text-muted">
            Ainda não há pauta pra revisar.
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((p, i) => {
              const badge = BADGE[p.approval_status] ?? BADGE.enviado;
              const fmt = FMT[p.format] ?? { bg: "#64748b", label: p.format };
              const fbs = fbMap[p.id] ?? [];
              const d = new Date(p.planned_date);
              const dd = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
              const wd = d.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "");
              const approved = p.approval_status === "aprovado";
              return (
                <div key={p.id} className="card overflow-hidden">
                  <div className="flex flex-col sm:flex-row">
                    {/* ===== Badge do formato/data ===== */}
                    <div
                      className="flex shrink-0 flex-row items-center gap-3 px-4 py-3 text-white sm:w-28 sm:flex-col sm:justify-center sm:gap-0.5 sm:py-4"
                      style={{ background: fmt.bg }}
                    >
                      <span className="text-3xl font-black leading-none">{i + 1}</span>
                      <div className="flex flex-col sm:items-center">
                        <span className="text-[11px] font-bold uppercase tracking-wide">{fmt.label}</span>
                        <span className="text-sm font-bold">{dd}</span>
                        <span className="text-[11px] capitalize opacity-90">({wd})</span>
                      </div>
                    </div>

                    {/* ===== Conteúdo + ações ===== */}
                    <div className="min-w-0 flex-1 p-4">
                      <div className="mb-1 flex flex-wrap items-start justify-between gap-2">
                        <h3 className="text-base font-bold leading-snug text-ink">{p.title}</h3>
                        <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${badge.cls}`}>
                          {badge.label}
                        </span>
                      </div>
                      {p.brief && (
                        <div className="mt-1.5">
                          <div
                            ref={measureDesc(p.id)}
                            className={openDesc[p.id] ? "" : "max-h-[5.5rem] overflow-hidden"}
                          >
                            <FormattedBrief text={p.brief} />
                          </div>
                          {(longDesc[p.id] || openDesc[p.id]) && (
                            <button
                              onClick={() => setOpenDesc((s) => ({ ...s, [p.id]: !s[p.id] }))}
                              className="mt-1.5 text-xs font-bold text-brand-blue hover:underline"
                            >
                              {openDesc[p.id] ? "Ler menos ▴" : "Ler mais ▾"}
                            </button>
                          )}
                        </div>
                      )}

                      {/* comentários de todo mundo */}
                      {fbs.length > 0 && (
                        <div className="mt-3 space-y-1.5">
                          {fbs.map((f) => (
                            <div
                              key={f.id}
                              className={`rounded-xl p-2.5 text-sm ${f.action === "aprovado" ? "bg-emerald-50" : "bg-rose-50"}`}
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-ink">{f.author || "Cliente"}</span>
                                <span className="text-[11px] text-muted">
                                  {new Date(f.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
                                </span>
                              </div>
                              {f.message ? (
                                <p className={f.action === "aprovado" ? "text-emerald-800" : "text-rose-700"}>{f.message}</p>
                              ) : (
                                <p className="text-xs italic text-emerald-700">Aprovou sem comentário</p>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* botões */}
                      {openFor === p.id ? (
                        <div className="mt-3 space-y-2">
                          <textarea
                            value={text}
                            onChange={(e) => setText(e.target.value)}
                            autoFocus
                            placeholder="O que precisa mudar? (assunto, formato, data, abordagem…)"
                            className="h-20 w-full resize-none rounded-xl border border-line bg-canvas p-3 text-sm outline-none focus:border-brand-blue focus:bg-white"
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={() => act(p.id, "ajustes", text)}
                              disabled={busy === p.id || !named || !text.trim()}
                              className="flex-1 rounded-xl bg-rose-600 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                            >
                              {busy === p.id ? "Enviando…" : "Enviar correção"}
                            </button>
                            <button
                              onClick={() => setOpenFor(null)}
                              className="rounded-xl border border-line px-3 text-sm font-semibold text-muted"
                            >
                              Cancelar
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="mt-3 flex gap-2">
                          <button
                            onClick={() => act(p.id, "aprovado")}
                            disabled={busy === p.id || !named}
                            className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold text-white disabled:opacity-50 ${
                              approved ? "bg-emerald-500" : "bg-emerald-600 hover:bg-emerald-700"
                            }`}
                          >
                            {busy === p.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : approved ? (
                              <Check className="h-4 w-4" />
                            ) : (
                              <ThumbsUp className="h-4 w-4" />
                            )}
                            {approved ? "Aprovado" : "Aprovar"}
                          </button>
                          <button
                            onClick={() => {
                              setOpenFor(p.id);
                              setText("");
                            }}
                            disabled={!named}
                            className="flex items-center gap-2 rounded-xl border border-rose-200 bg-white px-3 py-2.5 text-sm font-semibold text-rose-600 transition hover:bg-rose-50 disabled:opacity-50"
                          >
                            {fbs.some((f) => f.action === "ajustes") ? <Pencil className="h-4 w-4" /> : <X className="h-4 w-4" />}
                            Reprovar
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-8 text-center text-xs text-muted">
          Gerado por <b>MarkSeg Studio</b> · studio.markseg.com.br
        </div>
      </div>
    </div>
  );
}
