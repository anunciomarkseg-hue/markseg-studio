"use client";

import { useState } from "react";
import { Search, Check, Plus, X } from "lucide-react";
import type { SocialAccount } from "@/lib/types";
import { Avatar } from "./Avatar";

export function AccountMultiSelect({
  accounts,
  selected,
  onChange,
}: {
  accounts: SocialAccount[];
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  const byId = new Map(accounts.map((a) => [a.id, a]));
  const chosen = selected.map((id) => byId.get(id)).filter(Boolean) as SocialAccount[];
  const filtered = accounts.filter((a) =>
    `${a.name} ${a.handle}`.toLowerCase().includes(q.toLowerCase()),
  );

  function toggle(id: string) {
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {chosen.map((a) => (
        <span
          key={a.id}
          className="flex items-center gap-2 rounded-xl border border-brand-blue bg-brand-blue-50 px-2.5 py-1.5 text-sm font-semibold text-brand-blue-700"
        >
          <Avatar account={a} size={22} />
          {a.handle}
          <button onClick={() => toggle(a.id)} aria-label="remover">
            <X className="h-3.5 w-3.5" />
          </button>
        </span>
      ))}

      <div className="relative">
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-1.5 rounded-xl border border-dashed border-slate-300 px-3 py-2 text-sm font-semibold text-muted transition-fluid hover:border-brand-blue hover:text-brand-blue"
        >
          <Plus className="h-4 w-4" /> {chosen.length ? "Adicionar" : "Escolher conta"}
        </button>

        {open && (
          <>
            <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
            <div className="absolute left-0 top-full z-40 mt-2 w-[min(18rem,calc(100vw-2rem))] rounded-2xl border border-line bg-surface p-2 shadow-pop">
              <div className="flex items-center gap-2 rounded-lg border border-line bg-canvas px-2.5 py-1.5">
                <Search className="h-4 w-4 text-muted" />
                <input
                  autoFocus
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Buscar conta..."
                  className="w-full bg-transparent text-sm text-ink outline-none"
                />
              </div>
              <div className="mt-2 max-h-72 overflow-y-auto">
                {filtered.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => toggle(a.id)}
                    className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left hover:bg-canvas"
                  >
                    <Avatar account={a} size={28} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-ink">{a.handle}</span>
                      <span className="block truncate text-xs text-muted">{a.name}</span>
                    </span>
                    {selected.includes(a.id) && <Check className="h-4 w-4 text-brand-blue" />}
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
    </div>
  );
}
