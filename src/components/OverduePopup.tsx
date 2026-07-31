"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, X, CalendarClock } from "lucide-react";

interface OverdueItem {
  id: string;
  planned_date: string;
  title: string;
  client: string;
}

/**
 * Popup CHAMATIVO que aparece sozinho quando há posts ATRASADOS
 * (aprovados, com data vencida e ainda não agendados). Some ao fechar
 * (não volta a incomodar na mesma sessão).
 */
export function OverduePopup() {
  const [items, setItems] = useState<OverdueItem[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem("overdue_dismissed") === "1") return;
    fetch("/api/editorial/overdue")
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d.overdue) && d.overdue.length > 0) {
          setItems(d.overdue);
          setOpen(true);
        }
      })
      .catch(() => {});
  }, []);

  function close() {
    setOpen(false);
    sessionStorage.setItem("overdue_dismissed", "1");
  }

  if (!open || items.length === 0) return null;

  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-pop animate-rise">
        {/* topo alarmante */}
        <div className="relative bg-gradient-to-r from-rose-600 to-red-500 px-6 py-5 text-white">
          <button
            onClick={close}
            className="absolute right-4 top-4 text-white/80 transition hover:text-white"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 shrink-0 animate-pulse place-items-center rounded-2xl bg-white/20">
              <AlertTriangle className="h-6 w-6" />
            </span>
            <div>
              <p className="text-2xl font-black leading-none">
                {items.length} post{items.length > 1 ? "s" : ""} atrasado{items.length > 1 ? "s" : ""}!
              </p>
              <p className="mt-1 text-sm text-white/90">A data passou e ainda não foram agendados.</p>
            </div>
          </div>
        </div>

        {/* lista */}
        <div className="max-h-60 space-y-2 overflow-y-auto px-5 py-4">
          {items.slice(0, 8).map((p) => (
            <div key={p.id} className="flex items-center gap-2.5 rounded-xl border border-rose-100 bg-rose-50/60 p-2.5">
              <CalendarClock className="h-4 w-4 shrink-0 text-rose-500" />
              <span className="shrink-0 text-xs font-bold text-rose-600">
                {new Date(p.planned_date).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
              </span>
              <span className="shrink-0 text-xs font-semibold text-ink">{p.client}</span>
              <span className="min-w-0 flex-1 truncate text-xs text-muted">{p.title}</span>
            </div>
          ))}
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
            Depois
          </button>
          <Link
            href="/pauta"
            onClick={close}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-rose-600 py-2.5 text-sm font-bold text-white transition-fluid hover:bg-rose-700"
          >
            Agendar agora
          </Link>
        </div>
      </div>
    </div>
  );
}
