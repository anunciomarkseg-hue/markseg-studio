import { redirect } from "next/navigation";
import { currentAgent } from "@/lib/central/guard";
import { CentralConfigClient } from "@/components/CentralConfigClient";

export const dynamic = "force-dynamic";

export default async function CentralConfigPage() {
  const { level } = await currentAgent();
  if (level !== "admin") redirect("/central");
  return <CentralConfigClient />;
}
