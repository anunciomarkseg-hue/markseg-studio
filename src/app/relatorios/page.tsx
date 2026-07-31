import { listAccounts } from "@/lib/db";
import type { SocialAccount } from "@/lib/types";
import { RelatoriosClient } from "@/components/RelatoriosClient";

export const dynamic = "force-dynamic";

export default async function RelatoriosPage() {
  let accounts: SocialAccount[] = [];
  try {
    accounts = (await listAccounts()).filter(
      (a) => a.platform === "instagram" || a.platform === "facebook",
    );
  } catch {
    // vazio se o banco falhar
  }

  return <RelatoriosClient accounts={accounts} />;
}
