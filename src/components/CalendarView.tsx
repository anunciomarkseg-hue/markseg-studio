"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, AlertTriangle, Clock, CircleDashed } from "lucide-react";
import type { CalendarPost, CalendarPostStatus } from "@/lib/calendar";
import { PlatformIcon } from "@/components/PlatformIcon";
import type { Platform } from "@/lib/types";
import { commemorativesForYear, commemorativesOn } from "@/lib/commemorative";

const WD = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

/** Status exibido (deriva "atrasado" quando pendente + data já vencida). */
export type DisplayStatus = "publicado" | "erro" | "atrasado" | "pendente";
export function displayStatus(p: CalendarPost): DisplayStatus {
  if (p.status === "publicado") return "publicado";
  if (p.status === "erro") return "erro";
  if (p.status === "atrasado") return "atrasado";
  if (new Date(p.planned_date).getTime() < Date.now()) return "atrasado"; // derivado
  return "pendente";
}

/** Opções de status que dá pra marcar na mão. */
export const STATUS_OPTS: { s: CalendarPostStatus; label: string; on: string }[] = [
  { s: "publicado", label: "Publicado", on: "bg-emerald-600 text-white" },
  { s: "atrasado", label: "Atrasado", on: "bg-amber-500 text-white" },
  { s: "erro", label: "Erro técnico", on: "bg-rose-600 text-white" },
  { s: "pendente", label: "Pendente", on: "bg-slate-500 text-white" },
];
export const STATUS_META: Record<
  DisplayStatus,
  { label: string; chip: string; dot: string; icon: typeof CheckCircle2 }
> = {
  publicado: { label: "Publicado", chip: "bg-emerald-100 text-emerald-700", dot: "#15a06b", icon: CheckCircle2 },
  erro: { label: "Erro técnico", chip: "bg-rose-100 text-rose-700", dot: "#e11d48", icon: AlertTriangle },
  atrasado: { label: "Atrasado", chip: "bg-amber-100 text-amber-800", dot: "#f59e0b", icon: Clock },
  pendente: { label: "Pendente", chip: "bg-slate-100 text-slate-600", dot: "#94a3b8", icon: CircleDashed },
};

/** Cor + rótulo por formato — mesma linguagem visual da pauta. */
export const FMT: Record<string, { bg: string; soft: string; text: string; label: string }> = {
  feed: { bg: "#15a06b", soft: "#e7f6ef", text: "#0f7a50", label: "Estático" },
  carrossel: { bg: "#f26a2c", soft: "#fdeee4", text: "#c14e18", label: "Carrossel" },
  reel: { bg: "#1c6fce", soft: "#e6f0fb", text: "#1558a6", label: "Vídeo / Reel" },
  story: { bg: "#8B5CF6", soft: "#f0eafd", text: "#6d3fd4", label: "Story" },
};
export const fmtOf = (f: string) => FMT[f] ?? { bg: "#64748b", soft: "#f1f5f9", text: "#475569", label: f };

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** Agrupa posts por mês (YYYY-MM). Normalmente é um mês só. */
function byMonth(posts: CalendarPost[]) {
  const map = new Map<string, CalendarPost[]>();
  for (const p of posts) {
    const d = new Date(p.planned_date);
    const k = `${d.getFullYear()}-${String(d.getMonth()).padStart(2, "0")}`;
    (map.get(k) ?? map.set(k, []).get(k)!).push(p);
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, list]) => {
      const [y, m] = k.split("-").map(Number);
      return { year: y, month: m, posts: list };
    });
}

function MonthGrid({
  year,
  month,
  posts,
  editable = false,
  onSetStatus,
  busyId,
}: {
  year: number;
  month: number;
  posts: CalendarPost[];
  editable?: boolean;
  onSetStatus?: (postId: string, status: CalendarPostStatus) => void;
  busyId?: string | null;
}) {
  const today = new Date();
  const comemos = useMemo(() => commemorativesForYear(year), [year]);
  const [menuFor, setMenuFor] = useState<string | null>(null);

  const cells = useMemo(() => {
    const first = new Date(year, month, 1).getDay();
    const days = new Date(year, month + 1, 0).getDate();
    const out: (Date | null)[] = [];
    for (let i = 0; i < first; i++) out.push(null);
    for (let d = 1; d <= days; d++) out.push(new Date(year, month, d));
    while (out.length % 7 !== 0) out.push(null);
    return out;
  }, [year, month]);

  // Post 1, 2, 3… em ordem cronológica no mês
  const numberOf = useMemo(() => {
    const sorted = [...posts].sort((a, b) => +new Date(a.planned_date) - +new Date(b.planned_date));
    const m: Record<string, number> = {};
    sorted.forEach((p, i) => (m[p.id] = i + 1));
    return m;
  }, [posts]);

  const dayPosts = (d: Date) => posts.filter((p) => isSameDay(new Date(p.planned_date), d));
  const monthLabel = new Date(year, month, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-card">
      <div className="flex items-center justify-between bg-[#22315f] px-4 py-2.5">
        <span className="text-sm font-bold capitalize text-white">{monthLabel}</span>
        <span className="text-[11px] font-semibold uppercase tracking-wider text-white/60">
          {posts.length} post{posts.length > 1 ? "s" : ""}
        </span>
      </div>

      {/* DESKTOP: grade */}
      <div className="hidden md:grid md:grid-cols-7">
        {WD.map((d) => (
          <div key={d} className="bg-[#2c3d6e] px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-white/80">
            {d}
          </div>
        ))}
        {cells.map((date, i) => {
          if (!date) return <div key={i} className="min-h-28 border-b border-r border-line/60 bg-canvas/40" />;
          const items = dayPosts(date);
          const isToday = isSameDay(date, today);
          const comm = commemorativesOn(comemos, date).slice(0, 1);
          return (
            <div key={i} className="min-h-28 border-b border-r border-line/60 p-1.5">
              <div className="mb-1 flex items-center justify-between">
                <span
                  className={`inline-grid h-6 w-6 place-items-center rounded-full text-xs font-bold ${
                    isToday ? "gradient-brand text-white" : "text-slate-400"
                  }`}
                >
                  {date.getDate()}
                </span>
              </div>
              {comm.map((name) => (
                <div
                  key={name}
                  title={name}
                  className="mb-1 truncate rounded bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-700"
                >
                  {name}
                </div>
              ))}
              <div className="space-y-1.5">
                {items.map((p) => {
                  const f = fmtOf(p.format);
                  const st = displayStatus(p);
                  const open = menuFor === p.id;
                  return (
                    <div key={p.id} className="relative">
                      <button
                        type="button"
                        onClick={() => editable && setMenuFor(open ? null : p.id)}
                        className={`block w-full rounded-r-md border-l-[3px] px-2 py-1.5 text-left ${editable ? "transition-fluid hover:brightness-95" : "cursor-default"}`}
                        style={{ borderColor: f.bg, background: f.soft }}
                      >
                        <span className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wide" style={{ color: f.text }}>
                          <span
                            className="h-1.5 w-1.5 shrink-0 rounded-full"
                            style={{ background: STATUS_META[st].dot }}
                            title={STATUS_META[st].label}
                          />
                          Post {numberOf[p.id]} · {f.label}
                        </span>
                        {p.title && <span className="mt-0.5 block text-[11px] font-semibold leading-tight text-ink line-clamp-2">{p.title}</span>}
                      </button>

                      {editable && open && onSetStatus && (
                        <>
                          <div className="fixed inset-0 z-20" onClick={() => setMenuFor(null)} />
                          <div className="absolute left-0 top-full z-30 mt-1 w-40 rounded-xl border border-line bg-surface p-1 shadow-pop">
                            <p className="px-2 py-1 text-[10px] font-bold uppercase text-muted">Marcar status</p>
                            {STATUS_OPTS.map((o) => (
                              <button
                                key={o.s}
                                disabled={busyId === p.id}
                                onClick={() => {
                                  onSetStatus(p.id, o.s);
                                  setMenuFor(null);
                                }}
                                className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs font-semibold hover:bg-canvas ${
                                  p.status === o.s ? "text-ink" : "text-muted"
                                }`}
                              >
                                <span className="h-2 w-2 rounded-full" style={{ background: STATUS_META[o.s].dot }} />
                                {o.label}
                              </button>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* MOBILE: mini-grade (bolinhas) */}
      <div className="md:hidden">
        <div className="grid grid-cols-7 border-b border-line px-1 pt-2 text-center text-[10px] font-semibold text-muted">
          {WD.map((d) => (
            <div key={d}>{d.slice(0, 1)}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 px-1 pb-2">
          {cells.map((date, i) => {
            if (!date) return <div key={i} className="h-10" />;
            const items = dayPosts(date);
            const isToday = isSameDay(date, today);
            return (
              <div key={i} className="flex h-10 flex-col items-center justify-center gap-0.5">
                <span
                  className={`grid h-6 w-6 place-items-center rounded-full text-xs font-semibold ${
                    isToday ? "gradient-brand text-white" : "text-ink"
                  }`}
                >
                  {date.getDate()}
                </span>
                <span className="flex h-1.5 items-center gap-0.5">
                  {items.slice(0, 3).map((p) => (
                    <span key={p.id} className="h-1.5 w-1.5 rounded-full" style={{ background: fmtOf(p.format).bg }} />
                  ))}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/** Lista vertical detalhada (Post 1, 2, 3…) — bom pra ler no celular e ver o briefing. */
function DetailList({
  posts,
  editable = false,
  onSetStatus,
  busyId,
}: {
  posts: CalendarPost[];
  editable?: boolean;
  onSetStatus?: (postId: string, status: CalendarPostStatus) => void;
  busyId?: string | null;
}) {
  const sorted = [...posts].sort((a, b) => +new Date(a.planned_date) - +new Date(b.planned_date));
  return (
    <div className="space-y-2.5">
      {sorted.map((p, i) => {
        const f = fmtOf(p.format);
        const d = new Date(p.planned_date);
        const dd = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
        const wd = d.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "");
        const st = displayStatus(p);
        const S = STATUS_META[st];
        return (
          <div key={p.id} className="overflow-hidden rounded-2xl border border-line bg-white shadow-card">
            <div className="flex">
              <div
                className="flex w-20 shrink-0 flex-col items-center justify-center gap-0.5 py-3 text-white"
                style={{ background: f.bg }}
              >
                <span className="text-2xl font-black leading-none">{i + 1}</span>
                <span className="text-[10px] font-bold uppercase tracking-wide">{f.label}</span>
                <span className="text-sm font-bold">{dd}</span>
                <span className="text-[10px] capitalize opacity-90">({wd})</span>
              </div>
              <div className="min-w-0 flex-1 p-3.5">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  {(p.networks ?? []).slice(0, 3).map((n) => (
                    <PlatformIcon key={n} platform={n as Platform} className="h-3.5 w-3.5 text-muted" />
                  ))}
                  <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${S.chip}`}>
                    <S.icon className="h-3 w-3" /> {S.label}
                  </span>
                </div>
                <h3 className="text-sm font-bold leading-snug text-ink">{p.title || f.label}</h3>
                {p.brief && (
                  <p className="mt-1 whitespace-pre-wrap text-[13px] leading-relaxed text-muted">{p.brief}</p>
                )}
                {editable && onSetStatus && (
                  <div className="mt-2.5 flex flex-wrap items-center gap-1.5 border-t border-line pt-2.5">
                    <span className="text-[11px] font-semibold text-muted">Marcar:</span>
                    {STATUS_OPTS.map((o) => {
                      const active = p.status === o.s;
                      return (
                        <button
                          key={o.s}
                          onClick={() => onSetStatus(p.id, o.s)}
                          disabled={busyId === p.id}
                          className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-fluid disabled:opacity-50 ${
                            active ? o.on : "bg-canvas text-muted hover:text-ink"
                          }`}
                        >
                          {o.label}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Legenda de cores por formato. */
function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
      {Object.values(FMT).map((f) => (
        <span key={f.label} className="flex items-center gap-1.5 text-xs font-semibold text-muted">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: f.bg }} />
          {f.label}
        </span>
      ))}
    </div>
  );
}

/**
 * Visão completa e READ-ONLY de um calendário editorial: banner do tema,
 * legenda, grade do mês e a lista detalhada. Usada na prévia interna e na
 * página pública do cliente.
 */
export function CalendarView({
  theme,
  posts,
  showList = true,
  editable = false,
  onSetStatus,
  busyId,
}: {
  theme?: string;
  posts: CalendarPost[];
  showList?: boolean;
  editable?: boolean;
  onSetStatus?: (postId: string, status: CalendarPostStatus) => void;
  busyId?: string | null;
}) {
  const months = useMemo(() => byMonth(posts), [posts]);

  if (!posts.length) {
    return (
      <div className="grid place-items-center rounded-2xl border border-dashed border-line bg-canvas p-10 text-center text-sm text-muted">
        Este calendário ainda não tem posts.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {theme ? (
        <div className="flex items-center gap-2 rounded-xl bg-brand-blue-700 px-4 py-2.5 text-sm font-bold uppercase tracking-wide text-white">
          <span className="h-2 w-2 shrink-0 rounded-full bg-brand-amber" />
          Tema do mês · <span className="font-extrabold">{theme}</span>
        </div>
      ) : null}

      <Legend />

      {months.map((m) => (
        <MonthGrid
          key={`${m.year}-${m.month}`}
          year={m.year}
          month={m.month}
          posts={m.posts}
          editable={editable}
          onSetStatus={onSetStatus}
          busyId={busyId}
        />
      ))}

      {/* Legenda de status */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
        {(["publicado", "atrasado", "erro", "pendente"] as DisplayStatus[]).map((s) => (
          <span key={s} className="flex items-center gap-1.5 text-xs font-semibold text-muted">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: STATUS_META[s].dot }} />
            {STATUS_META[s].label}
          </span>
        ))}
      </div>

      {showList && (
        <div>
          <p className="mb-2.5 text-xs font-bold uppercase tracking-wide text-muted">Detalhes de cada post</p>
          <DetailList posts={posts} editable={editable} onSetStatus={onSetStatus} busyId={busyId} />
        </div>
      )}
    </div>
  );
}
