import { listAccounts } from "@/lib/db";
import { getActiveGroup } from "@/lib/active";
import { buildClients } from "@/lib/clients";
import {
  listEditorial,
  listPendingScheduling,
  listPendingAjustes,
  getMonthThemes,
  type EditorialPost,
} from "@/lib/editorial";
import { PautaClient } from "@/components/PautaClient";
import type { SocialAccount } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function PautaPage() {
  let accounts: SocialAccount[] = [];
  let posts: EditorialPost[] = [];
  let pending: EditorialPost[] = [];
  let ajustes: EditorialPost[] = [];
  let themes: Record<string, string> = {};

  const activeGroup = await getActiveGroup();
  try {
    accounts = await listAccounts();
    [posts, pending, ajustes] = await Promise.all([
      listEditorial(activeGroup ?? undefined),
      listPendingScheduling(),
      listPendingAjustes(),
    ]);
    if (activeGroup) themes = await getMonthThemes(activeGroup);
  } catch {
    // vazio se o banco falhar
  }

  const clients = buildClients(accounts);

  return (
    <PautaClient
      accounts={accounts}
      activeGroup={activeGroup}
      clients={clients}
      posts={posts}
      pending={pending}
      ajustes={ajustes}
      themes={themes}
    />
  );
}
