"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

// Não conta nas telas de cliente/login.
const OFF = ["/login", "/definir-senha", "/r/", "/aprovar", "/termos", "/privacidade"];
const SEEN_KEY = "feed_last_seen";

type Badger = Navigator & {
  setAppBadge?: (n?: number) => Promise<void>;
  clearAppBadge?: () => Promise<void>;
};

function myName(): string {
  try {
    return (JSON.parse(localStorage.getItem("feed_me") || "null")?.name as string) || "";
  } catch {
    return "";
  }
}

/**
 * Contador de mensagens não lidas das Conversas — mostra no título da aba
 * "(3) …" e no ícone do app instalado (badge da barra de tarefas).
 * Zera quando a pessoa está vendo as Conversas; acumula quando está fora/minimizado.
 */
export function UnreadBadge() {
  const pathname = usePathname();
  const active = !OFF.some((p) => pathname.startsWith(p));
  const pathRef = useRef(pathname);
  pathRef.current = pathname;

  useEffect(() => {
    if (!active) return;
    if (!localStorage.getItem(SEEN_KEY)) localStorage.setItem(SEEN_KEY, String(Date.now()));
    const nav = navigator as Badger;
    let stop = false;

    const stripBase = () => document.title.replace(/^\(\d+\)\s*/, "");
    function apply(n: number) {
      const base = stripBase();
      document.title = n > 0 ? `(${n}) ${base}` : base;
      try {
        if (n > 0) nav.setAppBadge?.(n);
        else nav.clearAppBadge?.();
      } catch {
        /* navegador sem suporte a badge */
      }
    }

    async function tick() {
      if (stop) return;
      // vendo as Conversas agora → zera
      if (pathRef.current.startsWith("/conversas") && document.visibilityState === "visible") {
        localStorage.setItem(SEEN_KEY, String(Date.now()));
        apply(0);
        return;
      }
      try {
        // Pede só o NÚMERO ao servidor. Antes baixava o feed inteiro (100 posts
        // + comentários + reações) a cada 25s, em todas as telas, só pra contar.
        const seenTs = Number(localStorage.getItem(SEEN_KEY) || "0");
        const q = new URLSearchParams({ since: String(seenTs), me: myName() ?? "" });
        const d = (await (
          await fetch(`/api/feed/unread?${q}`, { cache: "no-store" })
        ).json()) as { unread?: number };
        apply(d.unread ?? 0);
      } catch {
        /* offline: ignora */
      }
    }

    tick();
    const iv = setInterval(tick, 25000);
    const onVis = () => tick();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      stop = true;
      clearInterval(iv);
      document.removeEventListener("visibilitychange", onVis);
      try {
        nav.clearAppBadge?.();
      } catch {
        /* nada */
      }
    };
  }, [active]);

  // Zera na hora ao abrir/entrar nas Conversas (sem esperar o próximo ciclo)
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (pathname.startsWith("/conversas") && document.visibilityState === "visible") {
      localStorage.setItem(SEEN_KEY, String(Date.now()));
      document.title = document.title.replace(/^\(\d+\)\s*/, "");
      try {
        (navigator as Badger).clearAppBadge?.();
      } catch {
        /* nada */
      }
    }
  }, [pathname]);

  return null;
}
