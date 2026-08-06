"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
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

/** Ferramenta externa (Streamlit) de geração de relatórios. */
export const REPORT_GENERATOR_URL =
  "https://markseg-agente-g4jgjxglkbjbqd7tdsp4a2.streamlit.app/";

export function Sidebar({
  userEmail,
  pautaAlerts = 0,
  level = "viewer",
}: {
  userEmail: string | null;
  pautaAlerts?: number;
  level?: AccessLevel;
}) {
  const pathname = usePathname();
  const isAdmin = level === "admin";
  const podePublicar = canPublish(level);
  const nav = NAV.filter((n) => !n.adminOnly || isAdmin);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-line bg-surface px-4 py-5 md:flex">
      {/* Logo */}
      <Link href="/" className="mb-6 flex flex-col items-start px-2">
        <span className="self-end pr-1 text-[10px] font-bold uppercase tracking-[0.3em] text-brand-orange">
          Studio
        </span>
        <Image src="/brand/markseg-logo.png" alt="MarkSeg Studio" width={132} height={38} priority />
      </Link>

      {/* CTA principal — só quem pode publicar */}
      {podePublicar && (
        <Link
          href="/publicar"
          className="gradient-brand mb-6 flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white shadow-card transition-fluid hover:opacity-95 hover:shadow-pop"
        >
          <Plus className="h-4 w-4" strokeWidth={2.6} />
          Nova publicação
        </Link>
      )}

      {/* Navegação */}
      <nav className="flex flex-1 flex-col gap-1">
        {nav.map(({ href, label, icon: Icon }) => {
          const active = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-fluid ${
                active
                  ? "bg-brand-blue-50 text-brand-blue-700"
                  : "text-muted hover:bg-canvas hover:text-ink"
              }`}
            >
              <Icon
                className={`h-[18px] w-[18px] ${active ? "text-brand-blue" : "text-slate-400 group-hover:text-ink"}`}
                strokeWidth={2.2}
              />
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
            className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-fluid ${
              isActive("/equipe")
                ? "bg-brand-blue-50 text-brand-blue-700"
                : "text-muted hover:bg-canvas hover:text-ink"
            }`}
          >
            <Users
              className={`h-[18px] w-[18px] ${isActive("/equipe") ? "text-brand-blue" : "text-slate-400 group-hover:text-ink"}`}
              strokeWidth={2.2}
            />
            <span className="flex-1">Equipe</span>
          </Link>
        )}

        {/* Ferramenta externa: Gerador de relatórios (abre em nova aba) */}
        <a
          href={REPORT_GENERATOR_URL}
          target="_blank"
          rel="noreferrer"
          className="group mt-1 flex items-center gap-3 rounded-xl border border-brand-orange/30 bg-orange-50/60 px-3 py-2.5 text-sm font-semibold text-brand-orange transition-fluid hover:bg-orange-100"
        >
          <FileBarChart className="h-[18px] w-[18px]" strokeWidth={2.2} />
          <span className="flex-1">Gerador de relatórios</span>
          <ExternalLink className="h-3.5 w-3.5 opacity-70" />
        </a>
      </nav>

      {/* Rodapé — usuário + sair */}
      <div className="mt-4 space-y-2">
        {userEmail && (
          <div className="flex items-center gap-2 rounded-2xl border border-line bg-canvas p-3">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full gradient-blue text-xs font-bold text-white">
              {userEmail.slice(0, 1).toUpperCase()}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-xs font-semibold text-ink">{userEmail}</span>
              <span className="block text-[10px] text-muted">Equipe MarkSeg</span>
            </span>
          </div>
        )}
        <Link
          href="/definir-senha"
          className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-muted transition-fluid hover:bg-canvas hover:text-ink"
        >
          <KeyRound className="h-[18px] w-[18px] text-slate-400" /> Trocar senha
        </Link>
        <form action="/auth/signout" method="post">
          <button
            type="submit"
            className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-muted transition-fluid hover:bg-canvas hover:text-ink"
          >
            <LogOut className="h-[18px] w-[18px] text-slate-400" /> Sair
          </button>
        </form>
      </div>
    </aside>
  );
}
