import { getShare } from "@/lib/db";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getClientInsights } from "@/lib/insights";
import { PublicReport } from "@/components/PublicReport";
import type { AccountInsights } from "@/lib/insights";

export const dynamic = "force-dynamic";

function NotFound() {
  return (
    <div className="grid min-h-screen place-items-center bg-canvas px-6 text-center">
      <p className="text-sm text-muted">Relatório não encontrado ou link inválido.</p>
    </div>
  );
}

export default async function PublicReportPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const share = await getShare(token);
  if (!share) return <NotFound />;

  const sb = getSupabaseAdmin();
  let accounts: { platform: string; external_id: string; access_token: string; name: string }[] = [];
  if (share.group_key) {
    const { data } = await sb
      .from("social_accounts")
      .select("platform, external_id, access_token, name")
      .eq("group_key", share.group_key);
    accounts = data ?? [];
  } else if (share.account_id) {
    const { data } = await sb
      .from("social_accounts")
      .select("platform, external_id, access_token, name")
      .eq("id", share.account_id);
    accounts = data ?? [];
  }
  if (accounts.length === 0) return <NotFound />;

  const network = (["all", "instagram", "facebook"].includes(share.network) ? share.network : "all") as
    | "all"
    | "instagram"
    | "facebook";

  let insights: AccountInsights | null = null;
  try {
    insights = await getClientInsights(accounts, share.days, network);
  } catch {
    insights = null;
  }

  const fb = accounts.find((a) => a.platform === "facebook");
  const clientName = fb?.name || accounts[0].name;

  return <PublicReport name={clientName} days={share.days} insights={insights} />;
}
