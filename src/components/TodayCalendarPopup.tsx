"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarCheck, X, Sparkles } from "lucide-react";
import { fmtOf } from "@/components/CalendarView";

interface TodayItem {
  id: string;
  planned_date: string;
  format: string;
  title: string;
  client: string;
}

/**
 * Alerta AMIGÁVEL que aparece sozinho quando há post(s) marcado(s) pra HOJE
 * em algum calendário editorial. Some ao fechar (não volta na mesma sessão).
 */
export function TodayCalendarPopup() {
  const [items, setItems] = useState<TodayItem[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem("today_cal_dismissed") === "1") return;
    fetch("/api/calendario/hoje")
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d.today) && d.today.length > 0) {
          setItems(d.today);
          setOpen(true);
        }
      })
      .catch(() => {});
  }, []);

  function close() {
    setOpen(false);
    sessionStorage.setItem("today_cal_dismissed", "1");
  }

  if (!open || items.length === 0) return null;

  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-pop animate-rise">
        {/* topo */}
        <div className="relative gradient-brand px-6 py-5 text-white">
          <button
            onClick={close}
            className="absolute right-4 top-4 text-white/80 transition hover:text-white"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white/20">
              <CalendarCheck className="h-6 w-6" />
            </span>
            <div>
              <p className="text-2xl font-black leading-none">
                {items.length} post{items.length > 1 ? "s" : ""} pra hoje!
              </p>
              <p className="mt-1 flex items-center gap-1 text-sm text-white/90">
                <Sparkles className="h-3.5 w-3.5" /> Tem conteúdo agendado no calendário editorial de hoje.
              </p>
            </div>
          </div>
        </div>

        {/* lista */}
        <div className="max-h-60 space-y-2 overflow-y-auto px-5 py-4">
          {items.slice(0, 8).map((p) => {
            const f = fmtOf(p.format);
            return (
              <div key={p.id} className="flex items-center gap-2.5 rounded-xl border border-line bg-canvas/60 p-2.5">
                <span
                  className="shrink-0 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase text-white"
                  style={{ background: f.bg }}
                >
                  {f.label}
                </span>
                <span className="shrink-0 text-xs font-semibold text-ink">{p.client}</span>
                <span className="min-w-0 flex-1 truncate text-xs text-muted">{p.title}</span>
              </div>
            );
          })}
          {items.length > 8 && (
            <p className="pt-1 text-center text-xs font-semibold text-muted">+{items.length - 8} outros</p>
          )}
        </div>

        {/* ações */}
        <div className="flex gap-2 border-t border-line px-5 py-4">
          <button
            onClick={close}
            className="rounded-xl border border-line px-4 py-2.5 text-sm font-semibold text-muted transition-fluid hover:text-ink"
          >
            Fechar
          </button>
          <Link
            href="/pauta/calendario"
            onClick={close}
            className="gradient-brand flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold text-white transition-fluid hover:opacity-95"
          >
            Ver calendário
          </Link>
        </div>
      </div>
    </div>
  );
}
