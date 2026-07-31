"use client";

import { usePathname } from "next/navigation";
import { OverduePopup } from "./OverduePopup";
import { UrgentOverlay } from "./UrgentOverlay";
import { UnreadBadge } from "./UnreadBadge";

/** Mostra o menu lateral + topo no app; some nas telas de login/criar senha e nas públicas. */
export function AppShell({
  sidebar,
  topbar,
  children,
}: {
  sidebar: React.ReactNode;
  topbar: React.ReactNode;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const bare =
    pathname === "/login" ||
    pathname.startsWith("/definir-senha") ||
    pathname.startsWith("/r/") ||
    pathname.startsWith("/aprovar") || // página pública do cliente (sem chrome interno)
    pathname.startsWith("/mural") || // mural de recados público
    pathname.startsWith("/conversas"); // rede social do time (público)

  if (bare)
    return (
      <>
        {children}
        <UrgentOverlay />
        <UnreadBadge />
      </>
    );

  return (
    <div className="flex min-h-screen">
      {sidebar}
      <div className="flex min-w-0 flex-1 flex-col">
        {topbar}
        <main className="flex-1 px-5 py-6 lg:px-8 lg:py-8">{children}</main>
      </div>
      <OverduePopup />
      <UrgentOverlay />
      <UnreadBadge />
    </div>
  );
}
