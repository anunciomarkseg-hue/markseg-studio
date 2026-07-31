"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Plus, CalendarDays } from "lucide-react";
import { fmtTime, isSameDay } from "@/lib/format";
import { STATUS_LABEL, type PostStatus, type ScheduledPost } from "@/lib/types";

const WD = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const CHIP: Record<PostStatus, string> = {
  rascunho: "bg-slate-100 text-slate-600",
  agendado: "bg-brand-blue-50 text-brand-blue-700",
  aguardando: "bg-amber-50 text-amber-700",
  publicado: "bg-emerald-50 text-emerald-700",
  falhou: "bg-rose-50 text-rose-600",
};
const DOT: Record<PostStatus, string> = {
  rascunho: "bg-slate-400",
  agendado: "bg-brand-blue",
  aguardando: "bg-amber-500",
  publicado: "bg-emerald-500",
  falhou: "bg-rose-500",
};

/** Post publicado direto na plataforma (fora do Estúdio). */
type PlatItem = {
  id: string;
  platform: "instagram" | "facebook";
  caption: string;
  permalink: string;
  timestamp: string;
  account: string;
};
const PLAT_ICON: Record<PlatItem["platform"], string> = { instagram: "📷", facebook: "📘" };

type Filter = "tudo" | "agendado" | "publicado" | "direto";
const FILTERS: { k: Filter; label: string }[] = [
  { k: "tudo", label: "Tudo" },
  { k: "agendado", label: "Agendados" },
  { k: "publicado", label: "Publicados" },
  { k: "direto", label: "Direto na rede" },
];

export function CalendarClient({ posts }: { posts: ScheduledPost[] }) {
  const today = new Date();
  const [view, setView] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selDay, setSelDay] = useState<Date | null>(null);

  // Publicados direto na plataforma (Meta Business / app), buscados sob demanda.
  const [plat, setPlat] = useState<PlatItem[]>([]);
  const [platLoading, setPlatLoading] = useState(true);
  useEffect(() => {
    let ok = true;
    fetch("/api/calendar/published")
      .then((r) => r.json())
      .then((d) => {
        if (ok && Array.isArray(d.items)) setPlat(d.items as PlatItem[]);
      })
      .catch(() => {})
      .finally(() => {
        if (ok) setPlatLoading(false);
      });
    return () => {
      ok = false;
    };
  }, []);
  // Filtro de leitura do calendário
  const [filter, setFilter] = useState<Filter>("tudo");
  const fPosts = useMemo(() => {
    if (filter === "direto") return [] as ScheduledPost[];
    if (filter === "agendado") return posts.filter((p) => p.status === "agendado");
    if (filter === "publicado") return posts.filter((p) => p.status === "publicado");
    return posts;
  }, [posts, filter]);
  const fPlat = useMemo(() => (filter === "tudo" || filter === "direto" ? plat : []), [plat, filter]);
  const platOn = (d: Date) => fPlat.filter((p) => isSameDay(new Date(p.timestamp), d));

  const cells = useMemo(() => {
    const year = view.getFullYear();
    const month = view.getMonth();
    const firstWeekday = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const out: (Date | null)[] = [];
    for (let i = 0; i < firstWeekday; i++) out.push(null);
    for (let d = 1; d <= daysInMonth; d++) out.push(new Date(year, month, d));
    while (out.length % 7 !== 0) out.push(null);
    return out;
  }, [view]);

  const monthLabel = view.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  // dias do mês que têm posts (do Estúdio ou publicados direto)
  const agenda = useMemo(() => {
    const days = cells.filter(Boolean) as Date[];
    return days
      .map((d) => ({
        date: d,
        posts: fPosts.filter((p) => isSameDay(new Date(p.scheduledFor), d)),
        plat: fPlat.filter((p) => isSameDay(new Date(p.timestamp), d)),
      }))
      .filter((d) => d.posts.length > 0 || d.plat.length > 0);
  }, [cells, fPosts, fPlat]);

  const agendaShown = selDay ? agenda.filter((a) => isSameDay(a.date, selDay)) : agenda;

  function shift(n: number) {
    setSelDay(null);
    setView((v) => new Date(v.getFullYear(), v.getMonth() + n, 1));
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 animate-rise">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink">Calendário</h1>
          <p className="mt-1 text-sm capitalize text-muted">{monthLabel}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => shift(-1)} className="grid h-9 w-9 place-items-center rounded-lg border border-line bg-surface text-muted transition-fluid hover:text-ink">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => {
              setSelDay(null);
              setView(new Date(today.getFullYear(), today.getMonth(), 1));
            }}
            className="rounded-lg border border-line bg-surface px-3 py-2 text-sm font-semibold text-ink transition-fluid hover:bg-canvas"
          >
            Hoje
          </button>
          <button onClick={() => shift(1)} className="grid h-9 w-9 place-items-center rounded-lg border border-line bg-surface text-muted transition-fluid hover:text-ink">
            <ChevronRight className="h-4 w-4" />
          </button>
          <Link href="/publicar" className="gradient-brand ml-1 flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-white transition-fluid hover:opacity-95">
            <Plus className="h-4 w-4" strokeWidth={2.6} /> <span className="hidden sm:inline">Publicar</span>
          </Link>
        </div>
      </div>

      {/* Filtro de leitura */}
      <div className="mb-3 flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <button
            key={f.k}
            onClick={() => setFilter(f.k)}
            className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-fluid ${
              filter === f.k
                ? "border-brand-blue bg-brand-blue-50 text-brand-blue-700"
                : "border-line bg-surface text-muted hover:text-ink"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Legenda */}
      <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted">
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Publicado (Estúdio)</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-brand-blue" /> Agendado</span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-violet-500" /> Publicado direto (fora do Estúdio)
          {platLoading ? <span className="text-violet-400"> · buscando…</span> : plat.length > 0 ? <span className="text-violet-400"> · {plat.length}</span> : null}
        </span>
      </div>

      {/* ===== MOBILE: mini-grade com bolinhas + agenda ===== */}
      <div className="md:hidden">
        <div className="card p-3">
          <div className="grid grid-cols-7 border-b border-line pb-2 text-center text-[11px] font-semibold text-muted">
            {WD.map((d) => (
              <div key={d}>{d.slice(0, 1)}</div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {cells.map((date, i) => {
              if (!date) return <div key={i} className="h-11" />;
              const dayPosts = fPosts.filter((p) => isSameDay(new Date(p.scheduledFor), date));
              const dayPlat = platOn(date);
              const isToday = isSameDay(date, today);
              const isSel = selDay && isSameDay(date, selDay);
              return (
                <button
                  key={i}
                  onClick={() => setSelDay(isSel ? null : date)}
                  className={`flex h-11 flex-col items-center justify-center gap-0.5 rounded-lg text-xs font-semibold transition-fluid ${
                    isSel ? "bg-brand-blue-50 ring-1 ring-brand-blue/40" : ""
                  }`}
                >
                  <span
                    className={`grid h-6 w-6 place-items-center rounded-full ${
                      isToday ? "gradient-brand text-white" : "text-ink"
                    }`}
                  >
                    {date.getDate()}
                  </span>
                  <span className="flex h-1.5 items-center gap-0.5">
                    {dayPosts.slice(0, 3).map((p) => (
                      <span key={p.id} className={`h-1.5 w-1.5 rounded-full ${DOT[p.status]}`} />
                    ))}
                    {dayPlat.slice(0, 2).map((p) => (
                      <span key={p.id} className="h-1.5 w-1.5 rounded-full bg-violet-500" />
                    ))}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* agenda do mês (ou do dia tocado) */}
        <div className="mt-4 space-y-3">
          {agendaShown.length === 0 ? (
            <div className="card grid place-items-center gap-2 p-8 text-center text-sm text-muted">
              <CalendarDays className="h-6 w-6" />
              {selDay ? "Nada nesse dia." : "Nenhuma publicação nesse mês."}
            </div>
          ) : (
            agendaShown.map(({ date, posts: dayPosts, plat: dayPlat }) => (
              <div key={date.toISOString()} className="card p-3">
                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">
                  {date.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "short" })}
                </p>
                <div className="space-y-2">
                  {dayPosts.map((p) => (
                    <Link
                      key={p.id}
                      href="/publicacoes"
                      className="flex items-center gap-2.5 rounded-xl border border-line p-2.5"
                    >
                      <span className="shrink-0 text-xs font-bold text-ink">{fmtTime(p.scheduledFor)}</span>
                      <span className="min-w-0 flex-1 truncate text-xs text-muted">
                        {p.caption || "(sem legenda)"}
                      </span>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${CHIP[p.status]}`}>
                        {STATUS_LABEL[p.status]}
                      </span>
                    </Link>
                  ))}
                  {dayPlat.map((p) => (
                    <a
                      key={p.id}
                      href={p.permalink || "#"}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-2.5 rounded-xl border border-violet-200 bg-violet-50/50 p-2.5"
                    >
                      <span className="shrink-0 text-sm">{PLAT_ICON[p.platform]}</span>
                      <span className="min-w-0 flex-1 truncate text-xs text-violet-800">
                        {p.caption || "(mídia sem legenda)"}
                      </span>
                      <span className="shrink-0 rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold text-violet-700">
                        direto
                      </span>
                    </a>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ===== DESKTOP: grade mensal completa ===== */}
      <div className="card hidden overflow-hidden p-3 md:block">
        <div className="grid grid-cols-7 border-b border-line pb-2 text-center text-xs font-semibold text-muted">
          {WD.map((d) => (
            <div key={d}>{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {cells.map((date, i) => {
            if (!date) return <div key={i} className="min-h-28 border-b border-r border-line/60 bg-canvas/40" />;
            const dayPosts = posts.filter((p) => isSameDay(new Date(p.scheduledFor), date));
            const dayPlat = platOn(date);
            const isToday = isSameDay(date, today);
            return (
              <div key={i} className="min-h-28 border-b border-r border-line/60 p-1.5">
                <div
                  className={`mb-1 inline-grid h-6 w-6 place-items-center rounded-full text-xs font-semibold ${
                    isToday ? "gradient-brand text-white" : "text-muted"
                  }`}
                >
                  {date.getDate()}
                </div>
                <div className="space-y-1">
                  {dayPosts.slice(0, 3).map((p) => (
                    <Link
                      key={p.id}
                      href="/publicacoes"
                      className={`block truncate rounded-md px-1.5 py-1 text-[11px] font-medium ${CHIP[p.status]}`}
                    >
                      {fmtTime(p.scheduledFor)} · {p.caption.slice(0, 18)}…
                    </Link>
                  ))}
                  {dayPosts.length > 3 && (
                    <div className="px-1.5 text-[11px] font-semibold text-muted">+{dayPosts.length - 3}</div>
                  )}
                  {dayPlat.slice(0, 2).map((p) => (
                    <a
                      key={p.id}
                      href={p.permalink || "#"}
                      target="_blank"
                      rel="noreferrer"
                      title={`Publicado direto no ${p.platform} — ${p.account}`}
                      className="block truncate rounded-md bg-violet-50 px-1.5 py-1 text-[11px] font-medium text-violet-700"
                    >
                      {PLAT_ICON[p.platform]} {p.caption.slice(0, 16) || "(mídia)"}
                    </a>
                  ))}
                  {dayPlat.length > 2 && (
                    <div className="px-1.5 text-[11px] font-semibold text-violet-500">+{dayPlat.length - 2} direto</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
