"use client";

import { useEffect } from "react";

/**
 * Recarrega o app sozinho quando sai um deploy novo.
 * Essencial pro PWA instalado: como ele fica aberto o dia todo, sem isso
 * nunca buscaria a versão nova. Compara a versão "assada" no bundle com a
 * versão atual de produção (/api/version) e dá reload quando difere.
 * Não recarrega enquanto a pessoa está digitando (busyRef).
 */
export function useAutoUpdate(busyRef?: { current: boolean }) {
  useEffect(() => {
    const baked = process.env.NEXT_PUBLIC_BUILD_STAMP;
    if (!baked) return; // ambiente local / sem Vercel: nada a fazer

    let stopped = false;
    async function check() {
      if (stopped || busyRef?.current) return;
      try {
        const r = await fetch("/api/version", { cache: "no-store" });
        if (!r.ok) return;
        const { v } = (await r.json()) as { v?: string };
        if (v && v !== baked) {
          const key = "mk_last_reload";
          const last = Number(sessionStorage.getItem(key) || "0");
          // trava anti-loop: no máximo 1 reload a cada 20s
          if (Date.now() - last > 20000) {
            sessionStorage.setItem(key, String(Date.now()));
            location.reload();
          }
        }
      } catch {
        /* offline: ignora */
      }
    }

    const iv = setInterval(check, 60000);
    const onVis = () => document.visibilityState === "visible" && check();
    document.addEventListener("visibilitychange", onVis);
    check(); // checa já ao abrir

    return () => {
      stopped = true;
      clearInterval(iv);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [busyRef]);
}
