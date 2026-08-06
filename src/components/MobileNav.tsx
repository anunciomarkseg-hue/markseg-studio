"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  Menu,
  X,
  LayoutDashboard,
  CalendarDays,
  ClipboardList,
  ListChecks,
  AtSign,
  BarChart3,
  StickyNote,
  MessageCircle,
  Plus,
  LogOut,
  KeyRound,
  Lock,
  FileBarChart,
  ExternalLink,
  Users,
} from "lucide-react";
import { REPORT_GENERATOR_URL } from "./Sidebar";
import { canPublish, type AccessLevel } from "@/lib/access";
import type { ComponentType } from "react";

type NavItem = {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string; strokeWidth?: number }>;
  adminOnly?: boolean;
};

const NAV: NavItem[] = [
  { href: "/", label: "Visão geral", icon: LayoutDashboard },
  { href: "/pauta", label: "Pauta", icon: ClipboardList },
  { href: "/calendario", label: "Calendário", icon: CalendarDays },
  { href: "/publicacoes", label: "Publicações", icon: ListChecks },
  { href: "/mural", label: "Mural", icon: StickyNote },
  { href: "/conversas", label: "Conversas", icon: MessageCircle },
  { href: "/cofre", label: "Cofre", icon: Lock, adminOnly: true },
  { href: "/contas", label: "Contas", icon: AtSign, adminOnly: true },
  { href: "/relatorios", label: "Analytics", icon: BarChart3 },
];

export function MobileNav({
  userEmail,
  pautaAlerts = 0,
  level = "viewer",
}: {
  userEmail: string | null;
  pautaAlerts?: number;
  level?: AccessLevel;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));
  const isAdmin = level === "admin";
  const podePublicar = canPublish(level);
  const nav = NAV.filter((n) => !n.adminOnly || isAdmin);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="relative grid h-9 w-9 place-items-center rounded-xl border border-line bg-canvas text-ink md:hidden"
        aria-label="Menu"
      >
        <Menu className="h-5 w-5" />
        {pautaAlerts > 0 && (
          <span className="absolute -right-1.5 -top-1.5 grid h-4 min-w-[16px] place-items-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
            {pautaAlerts}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-0 flex h-full w-72 flex-col bg-surface p-4 shadow-pop">
            <div className="mb-6 flex items-center justify-between">
              <Image src="/brand/markseg-logo.png" alt="MarkSeg" width={120} height={35} priority />
              <button onClick={() => setOpen(false)} className="text-muted">
                <X className="h-5 w-5" />
              </button>
            </div>

            {podePublicar && (
              <Link
                href="/publicar"
                onClick={() => setOpen(false)}
                className="gradient-brand mb-4 flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white"
              >
                <Plus className="h-4 w-4" strokeWidth={2.6} /> Nova publicação
              </Link>
            )}

            <nav className="flex flex-1 flex-col gap-1">
              {nav.map(({ href, label, icon: Icon }) => {
                const active = isActive(href);
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setOpen(false)}
                    className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium ${
                      active ? "bg-brand-blue-50 text-brand-blue-700" : "text-muted"
                    }`}
                  >
                    <Icon className={`h-[18px] w-[18px] ${active ? "text-brand-blue" : "text-slate-400"}`} strokeWidth={2.2} />
                    <span className="flex-1">{label}</span>
                    {href === "/pauta" && pautaAlerts > 0 && (
                      <span className="grid h-5 min-w-[20px] place-items-center rounded-full bg-rose-500 px-1.5 text-[11px] font-bold text-white">
                        {pautaAlerts}
                      </span>
                    )}
                  </Link>
                );
              })}

              {/* Área de admin — só admins veem */}
              {isAdmin && (
                <Link
                  href="/equipe"
                  onClick={() => setOpen(false)}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium ${
                    isActive("/equipe") ? "bg-brand-blue-50 text-brand-blue-700" : "text-muted"
                  }`}
                >
                  <Users
                    className={`h-[18px] w-[18px] ${isActive("/equipe") ? "text-brand-blue" : "text-slate-400"}`}
                    strokeWidth={2.2}
                  />
                  <span className="flex-1">Equipe</span>
                </Link>
              )}

              {/* Ferramenta externa: Gerador de relatórios */}
              <a
                href={REPORT_GENERATOR_URL}
                target="_blank"
                rel="noreferrer"
                onClick={() => setOpen(false)}
                className="mt-1 flex items-center gap-3 rounded-xl border border-brand-orange/30 bg-orange-50/60 px-3 py-2.5 text-sm font-semibold text-brand-orange"
              >
                <FileBarChart className="h-[18px] w-[18px]" strokeWidth={2.2} />
                <span className="flex-1">Gerador de relatórios</span>
                <ExternalLink className="h-3.5 w-3.5 opacity-70" />
              </a>
            </nav>

            <div className="mt-4 space-y-1 border-t border-line pt-3">
              {userEmail && <div className="truncate px-3 text-xs font-semibold text-muted">{userEmail}</div>}
              <Link
                href="/definir-senha"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-muted"
              >
                <KeyRound className="h-[18px] w-[18px] text-slate-400" /> Trocar senha
              </Link>
              <form action="/auth/signout" method="post">
                <button
                  type="submit"
                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-muted"
                >
                  <LogOut className="h-[18px] w-[18px] text-slate-400" /> Sair
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
