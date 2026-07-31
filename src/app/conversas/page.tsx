import { listFeed, type FeedPost } from "@/lib/feed";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ConversasClient } from "@/components/ConversasClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Conversas — MarkSeg Studio",
  description: "Rede social do time MarkSeg.",
};

export default async function ConversasPage() {
  let posts: FeedPost[] = [];
  try {
    posts = await listFeed();
  } catch {
    /* vazio se o banco falhar */
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

  return <ConversasClient initial={posts} isTeam={isTeam} />;
}
