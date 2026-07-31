"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { ensureAudioUnlock, playChime } from "@/lib/sound";

type Urgent = { id: string; author: string | null; message: string; created_at: string };

// Não aparece nas telas de cliente/login (o recado urgente é interno do time).
const OFF = ["/login", "/definir-senha", "/r/", "/aprovar", "/termos", "/privacidade"];

const SEEN_KEY = "mural_urgent_seen";
function getSeen(): string[] {
  try {
    return JSON.parse(localStorage.getItem(SEEN_KEY) || "[]");
  } catch {
    return [];
  }
}
function markSeen(id: string) {
  const s = getSeen();
  if (!s.includes(id)) localStorage.setItem(SEEN_KEY, JSON.stringify([id, ...s].slice(0, 30)));
}

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

/** Link clicável simples dentro do recado urgente. */
function Linked({ text }: { text: string }) {
  const parts = text.split(/(https?:\/\/[^\s]+|www\.[^\s]+)/gi);
  return (
    <>
      {parts.map((p, i) =>
        /^(https?:\/\/|www\.)/i.test(p) ? (
          <a
            key={i}
            href={p.startsWith("http") ? p : `https://${p}`}
            target="_blank"
            rel="noreferrer"
            className="break-all font-bold underline"
          >
            {p}
          </a>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  );
}

export function UrgentOverlay() {
  const pathname = usePathname();
  const active = !OFF.some((p) => pathname.startsWith(p));
  const [urgent, setUrgent] = useState<Urgent | null>(null);
  const repeatT = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!active) {
      setUrgent(null);
      return;
    }
    ensureAudioUnlock();
    let stop = false;

    async function check() {
      if (stop) return;
      try {
        const d = await (await fetch("/api/mural/urgent", { cache: "no-store" })).json();
        const u = d.urgent as Urgent | null;
        if (u && !getSeen().includes(u.id)) {
          setUrgent((cur) => (cur?.id === u.id ? cur : u));
        }
      } catch {
        /* offline: ignora */
      }
    }

    check();
    const iv = setInterval(check, 15000);
    const onVis = () => document.visibilityState === "visible" && check();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      stop = true;
      clearInterval(iv);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [active, pathname]);

  // Ao aparecer: som de alerta + vibração (e um reforço depois de 4s)
  useEffect(() => {
    if (!urgent) return;
    playChime("urgent");
    try {
      navigator.vibrate?.([300, 150, 300, 150, 400]);
    } catch {
      /* nada */
    }
    repeatT.current = setTimeout(() => playChime("urgent"), 4200);
    return () => {
      if (repeatT.current) clearTimeout(repeatT.current);
    };
  }, [urgent]);

  if (!urgent) return null;

  function dismiss() {
    if (urgent) markSeen(urgent.id);
    if (repeatT.current) clearTimeout(repeatT.current);
    setUrgent(null);
  }

  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-red-900/80 p-4 backdrop-blur-sm">
      <div className="flex max-h-[85dvh] w-full max-w-md flex-col overflow-hidden rounded-3xl border-4 border-red-500 bg-white shadow-2xl">
        {/* cabeçalho fixo */}
        <div className="flex shrink-0 items-center gap-3 bg-gradient-to-r from-red-600 to-red-500 px-5 py-3.5 text-white">
          <AlertTriangle className="h-7 w-7 shrink-0 animate-pulse" strokeWidth={2.5} />
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-red-100">Recado urgente</p>
            <p className="font-display text-lg font-black leading-tight">Atenção, equipe!</p>
          </div>
        </div>
        {/* corpo rola dentro do card (mensagem longa não estoura a tela) */}
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-ink">
            <Linked text={urgent.message} />
          </p>
          <p className="mt-3 text-xs font-semibold text-muted">
            {urgent.author || "Direção"} · {fmt(urgent.created_at)}
          </p>
        </div>
        {/* botão fixo embaixo */}
        <div className="flex shrink-0 justify-end border-t border-line px-5 py-3">
          <button
            onClick={dismiss}
            className="rounded-xl bg-red-600 px-6 py-2.5 text-sm font-bold text-white transition hover:bg-red-700"
          >
            Estou ciente
          </button>
        </div>
      </div>
    </div>
  );
}
