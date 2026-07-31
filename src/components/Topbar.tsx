import Link from "next/link";
import { Bell } from "lucide-react";
import { listAccounts } from "@/lib/db";
import { supabaseConfigured } from "@/lib/supabase";
import { getActiveGroup } from "@/lib/active";
import type { SocialAccount } from "@/lib/types";
import { AccountSwitcher } from "./AccountSwitcher";
import { MobileNav } from "./MobileNav";

async function safeAccounts(): Promise<SocialAccount[]> {
  if (!supabaseConfigured) return [];
  try {
    return await listAccounts();
  } catch {
    return [];
  }
}

export async function Topbar({ userEmail, pautaAlerts = 0 }: { userEmail: string | null; pautaAlerts?: number }) {
  const [accounts, activeGroup] = await Promise.all([safeAccounts(), getActiveGroup()]);

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-line bg-surface/80 px-4 backdrop-blur lg:px-8">
      <MobileNav userEmail={userEmail} pautaAlerts={pautaAlerts} />

      {/* Seletor de cliente (IG + FB juntos) */}
      <AccountSwitcher accounts={accounts} activeGroup={activeGroup} />

      <div className="flex-1" />

      <Link
        href="/pauta"
        title="Retornos do cliente (Pauta)"
        className="relative grid h-9 w-9 place-items-center rounded-xl border border-line bg-canvas text-muted transition-fluid hover:text-ink"
      >
        <Bell className="h-[18px] w-[18px]" />
        {pautaAlerts > 0 && (
          <span className="absolute -right-1.5 -top-1.5 grid h-4 min-w-[16px] place-items-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
            {pautaAlerts}
          </span>
        )}
      </Link>

      <span className="grid h-9 w-9 place-items-center rounded-full gradient-blue text-sm font-bold text-white">
        R
      </span>
    </header>
  );
}
