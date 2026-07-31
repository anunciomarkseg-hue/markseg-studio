import { getEditorialShare, listEditorial, listFeedbackForGroup } from "@/lib/editorial";
import { getSupabaseAdmin } from "@/lib/supabase";
import { PublicPautaClient } from "@/components/PublicPautaClient";

export const dynamic = "force-dynamic";

function NotFound() {
  return (
    <div className="grid min-h-screen place-items-center bg-canvas px-6 text-center">
      <p className="text-sm text-muted">Pauta não encontrada ou link inválido.</p>
    </div>
  );
}

export default async function AprovarPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const share = await getEditorialShare(token);
  if (!share) return <NotFound />;

  const all = await listEditorial(share.group_key);
  const posts = all.filter((p) => p.approval_status !== "rascunho");
  const feedback = await listFeedbackForGroup(share.group_key);

  const sb = getSupabaseAdmin();
  const { data } = await sb
    .from("social_accounts")
    .select("name, handle, platform, avatar")
    .eq("group_key", share.group_key)
    .limit(5);
  const ig = (data ?? []).find((a) => a.platform === "instagram");
  const fb = (data ?? []).find((a) => a.platform === "facebook");
  const clientName = fb?.name || ig?.name || data?.[0]?.name || "Cliente";
  const handle = (ig?.handle || data?.[0]?.handle || clientName).replace(/^@/, "");

  return (
    <PublicPautaClient
      token={token}
      clientName={clientName}
      handle={handle}
      posts={posts}
      feedbackMap={feedback}
    />
  );
}
