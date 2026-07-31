import { listAccounts } from "@/lib/db";
import { getActiveGroup } from "@/lib/active";
import { buildClients } from "@/lib/clients";
import { listAllCalendarsWithPosts, type CalendarWithPosts } from "@/lib/calendar";
import { CalendarStudioClient } from "@/components/CalendarStudioClient";
import type { SocialAccount } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function CalendarioEditorialPage() {
  let accounts: SocialAccount[] = [];
  let calendars: CalendarWithPosts[] = [];

  const activeGroup = await getActiveGroup();
  try {
    accounts = await listAccounts();
    calendars = await listAllCalendarsWithPosts();
  } catch {
    // vazio se o banco falhar
  }

  const clients = buildClients(accounts);
  const activeClientName = clients.find((c) => c.key === activeGroup)?.name ?? "";

  return (
    <CalendarStudioClient
      calendars={calendars}
      clientSuggestions={clients.map((c) => c.name)}
      activeClientName={activeClientName}
    />
  );
}
