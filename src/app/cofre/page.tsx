import { redirect } from "next/navigation";
import { currentVaultViewer } from "@/lib/vault-guard";
import { vaultConfigured } from "@/lib/vault-crypto";
import { supabaseConfigured } from "@/lib/supabase";
import { canUseVault } from "@/lib/vault";
import { CofreClient } from "@/components/CofreClient";

export const dynamic = "force-dynamic";

export default async function CofrePage() {
  // Precisa estar logado e ter nível que use o cofre (admin ou editor).
  const viewer = await currentVaultViewer();
  if (!viewer) redirect("/login");
  if (!canUseVault(viewer.level)) redirect("/");

  return (
    <CofreClient
      viewer={{ level: viewer.level, isOwner: viewer.isOwner }}
      configured={supabaseConfigured && vaultConfigured()}
    />
  );
}
