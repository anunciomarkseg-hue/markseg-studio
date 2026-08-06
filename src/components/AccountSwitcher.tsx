"use client";

import { useMemo, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { ChevronDown, Search, Check, Users } from "lucide-react";
import type { SocialAccount } from "@/lib/types";
import { buildClients } from "@/lib/clients";
import { PlatformIcon } from "./PlatformIcon";

export function AccountSwitcher({
  accounts,
  activeGroup,
}: {
  accounts: SocialAccount[];
  activeGroup: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  const clients = useMemo(() => buildClients(accounts), [accounts]);
  const active = clients.find((c) => c.key === activeGroup) ?? null;

  // No Cofre não faz sentido o seletor de cliente global — ele tem as próprias
  // abas (Clientes / Interno da agência).
  if (pathname?.startsWith("/cofre")) return null;

  function choose(key: string) {
    if (key) document.cookie = `active_client=${key}; path=/; max-age=${60 * 60 * 24 * 365}`;
    else document.cookie = "active_client=; path=/; max-age=0";
    setOpen(false);
    setQ("");
    router.refresh();
  }

  const filtered = clients.filter((c) =>
    `${c.name} ${c.accounts.map((a) => a.handle).join(" ")}`.toLowerCase().includes(q.toLowerCase()),
  );

  function platformIcons(accs: SocialAccount[]) {
    return (
      <span className="flex items-center gap-1">
        {accs.some((a) => a.platform === "instagram") && (
          <PlatformIcon platform="instagram" className="h-3.5 w-3.5 text-brand-orange" />
        )}
        {accs.some((a) => a.platform === "facebook") && (
          <PlatformIcon platform="facebook" className="h-3.5 w-3.5 text-brand-blue" />
        )}
      </span>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex min-w-0 max-w-[165px] items-center gap-2 rounded-xl border border-line bg-canvas px-3 py-2 text-sm font-semibold text-ink transition-fluid hover:border-brand-blue/40 sm:max-w-[260px]"
      >
        {active ? (
          platformIcons(active.accounts)
        ) : (
          <span className="grid h-6 w-6 place-items-center rounded-md bg-brand-blue-50 text-brand-blue">
            <Users className="h-3.5 w-3.5" />
          </span>
        )}
        <span className="truncate">{active ? active.name : "Todas as contas"}</span>
        <ChevronDown className="h-4 w-4 shrink-0 text-muted" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full z-40 mt-2 w-[min(20rem,calc(100vw-2rem))] rounded-2xl border border-line bg-surface p-2 shadow-pop">
            <div className="flex items-center gap-2 rounded-lg border border-line bg-canvas px-2.5 py-1.5">
              <Search className="h-4 w-4 text-muted" />
              <input
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar cliente..."
                className="w-full bg-transparent text-sm text-ink outline-none"
              />
            </div>
            <div className="mt-2 max-h-80 overflow-y-auto">
              <button
                onClick={() => choose("")}
                className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left hover:bg-canvas"
              >
                <span className="grid h-7 w-7 place-items-center rounded-full bg-brand-blue-50 text-brand-blue">
                  <Users className="h-4 w-4" />
                </span>
                <span className="flex-1 text-sm font-semibold text-ink">Todas as contas</span>
                {!activeGroup && <Check className="h-4 w-4 text-brand-blue" />}
              </button>
              {filtered.map((c) => (
                <button
                  key={c.key}
                  onClick={() => choose(c.key)}
                  className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left hover:bg-canvas"
                >
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span className="truncate text-sm font-semibold text-ink">{c.name}</span>
                      {platformIcons(c.accounts)}
                    </span>
                    <span className="block truncate text-xs text-muted">
                      {c.accounts.map((a) => a.handle).join(" · ")}
                    </span>
                  </span>
                  {activeGroup === c.key && <Check className="h-4 w-4 shrink-0 text-brand-blue" />}
                </button>
              ))}
              {filtered.length === 0 && (
                <p className="px-2 py-3 text-center text-xs text-muted">Nada encontrado.</p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
