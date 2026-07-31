"use client";

import { Bell, BellRing } from "lucide-react";
import type { PushState } from "@/lib/usePush";

/** Botão de sino: liga/desliga os avisos de mensagem nova. Compartilhado (Mural + Conversas). */
export function PushBell({
  state,
  onEnable,
  onDisable,
}: {
  state: PushState;
  onEnable: () => void;
  onDisable: () => void;
}) {
  if (state === "loading" || state === "unsupported") return null;

  if (state === "on") {
    return (
      <button
        onClick={onDisable}
        title="Avisos ligados — clique pra desligar"
        className="flex items-center gap-1.5 rounded-lg border border-brand-blue bg-brand-blue-50 px-2.5 py-1.5 text-brand-blue-700"
      >
        <BellRing className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Avisos ligados</span>
      </button>
    );
  }

  return (
    <button
      onClick={state === "denied" ? undefined : onEnable}
      title={
        state === "denied"
          ? "Você bloqueou os avisos no navegador — libere nas permissões do site"
          : "Receber aviso (com som) de mensagem nova"
      }
      className={`flex items-center gap-1.5 rounded-lg border border-line bg-canvas px-2.5 py-1.5 text-brand-blue ${
        state === "denied" ? "opacity-50" : "hover:bg-brand-blue-50"
      }`}
    >
      <Bell className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Ativar avisos</span>
    </button>
  );
}
