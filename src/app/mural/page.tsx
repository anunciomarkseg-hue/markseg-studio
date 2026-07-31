import { listMural, type MuralMessage } from "@/lib/mural";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { MuralClient } from "@/components/MuralClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Mural de Recados — MarkSeg Studio",
  description: "Recados do time MarkSeg.",
};

export default async function MuralPage() {
  let messages: MuralMessage[] = [];
  try {
    messages = await listMural();
  } catch {
    // vazio se o banco falhar
  }

  let isTeam = false;
  try {
    const sb = await createSupabaseServerClient();
    const {
      data: { user },
    } = await sb.auth.getUser();
    isTeam = Boolean(user);
  } catch {
    /* visitante público */
  }

  return <MuralClient initial={messages} isTeam={isTeam} />;
}
