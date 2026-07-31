import { listAccounts } from "@/lib/db";
import { getActiveGroup } from "@/lib/active";
import { buildClients } from "@/lib/clients";
import { listCalendarsWithPosts, type CalendarWithPosts } from "@/lib/calendar";
import { CalendarStudioClient } from "@/components/CalendarStudioClient";
import type { SocialAccount } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function CalendarioEditorialPage() {
  let accounts: SocialAccount[] = [];
  let calendars: CalendarWithPosts[] = [];

  const activeGroup = await getActiveGroup();
  try {
    accounts = await listAccounts();
    if (activeGroup) calendars = await listCalendarsWithPosts(activeGroup);
  } catch {
    // vazio se o banco falhar
  }

  const clients = buildClients(accounts);

  return (
    <CalendarStudioClient
      activeGroup={activeGroup}
      clients={clients}
      calendars={calendars}
    />
  );
}
