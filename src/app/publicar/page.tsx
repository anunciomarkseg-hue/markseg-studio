import { listAccounts } from "@/lib/db";
import { getActiveGroup } from "@/lib/active";
import type { SocialAccount } from "@/lib/types";
import { Composer } from "@/components/Composer";

export const dynamic = "force-dynamic";

export default async function PublicarPage() {
  let accounts: SocialAccount[] = [];
  try {
    accounts = await listAccounts();
  } catch {
    // vazio se o banco falhar
  }
  const activeGroup = await getActiveGroup();

  return <Composer accounts={accounts} activeGroup={activeGroup} />;
}
