import { redirect } from "next/navigation";
import { currentAgent, canAttend } from "@/lib/central/guard";
import { CentralClient } from "@/components/CentralClient";

export const dynamic = "force-dynamic";

export default async function CentralPage() {
  const { level } = await currentAgent();
  if (!canAttend(level)) redirect("/");
  return <CentralClient isAdmin={level === "admin"} />;
}
