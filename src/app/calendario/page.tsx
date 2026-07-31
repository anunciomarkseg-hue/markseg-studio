import { listAccounts, listPosts } from "@/lib/db";
import { getActiveGroup } from "@/lib/active";
import { accountIdsForGroup } from "@/lib/clients";
import type { ScheduledPost, SocialAccount } from "@/lib/types";
import { CalendarClient } from "@/components/CalendarClient";

export const dynamic = "force-dynamic";

export default async function CalendarioPage() {
  let accounts: SocialAccount[] = [];
  let allPosts: ScheduledPost[] = [];
  try {
    [accounts, allPosts] = await Promise.all([listAccounts(), listPosts()]);
  } catch {
    // vazio se o banco falhar
  }

  const activeGroup = await getActiveGroup();
  const groupIds = accountIdsForGroup(accounts, activeGroup);
  const posts = activeGroup
    ? allPosts.filter((p) => p.accountIds.some((id) => groupIds.includes(id)))
    : allPosts;

  return <CalendarClient posts={posts} />;
}
