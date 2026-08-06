import { redirect } from "next/navigation";
import { isCurrentUserAdmin } from "@/lib/admin-guard";
import { EquipeClient } from "@/components/EquipeClient";

export const dynamic = "force-dynamic";

export default async function EquipePage() {
  // Só admin acessa. Quem não é, volta pra Visão geral.
  if (!(await isCurrentUserAdmin())) redirect("/");
  return <EquipeClient />;
}
