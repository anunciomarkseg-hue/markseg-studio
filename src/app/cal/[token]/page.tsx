import type { Metadata } from "next";
import Image from "next/image";
import { getCalendarByToken } from "@/lib/calendar";
import { getSupabaseAdmin, supabaseConfigured } from "@/lib/supabase";
import { CalendarView } from "@/components/CalendarView";

export const dynamic = "force-dynamic";

/** Preview do link (WhatsApp/redes) — client-friendly, NÃO o texto interno do Studio. */
export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const { token } = await params;
  const cal = await getCalendarByToken(token);
  if (!cal) {
    return { title: "Calendário editorial", robots: { index: false, follow: false } };
  }
  const client = cal.client_name?.trim() || (await clientNameFor(cal.group_key));
  const title = `Calendário editorial de ${client}`;
  const description = `${cal.title ? cal.title + " · " : ""}Veja o planejamento de conteúdo do mês — formatos, temas e datas dos posts.`;
  return {
    title,
    description,
    robots: { index: false, follow: false },
    openGraph: {
      title,
      description,
      type: "website",
      siteName: "MarkSeg",
    },
    twitter: { card: "summary_large_image", title, description },
  };
}

function NotFound() {
  return (
    <div className="grid min-h-screen place-items-center bg-canvas px-6 text-center">
      <p className="text-sm text-muted">Calendário não encontrado ou link inválido.</p>
    </div>
  );
}

async function clientNameFor(groupKey: string): Promise<string> {
  if (!supabaseConfigured) return "Cliente";
  const { data } = await getSupabaseAdmin()
    .from("social_accounts")
    .select("name, platform")
    .eq("group_key", groupKey)
    .limit(5);
  const fb = (data ?? []).find((a) => a.platform === "facebook");
  const ig = (data ?? []).find((a) => a.platform === "instagram");
  return fb?.name || ig?.name || data?.[0]?.name || "Cliente";
}

export default async function PublicCalendarPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const cal = await getCalendarByToken(token);
  if (!cal) return <NotFound />;

  // Prefere o nome digitado no upload; cai no antigo (conta conectada) se vazio.
  const clientName = cal.client_name?.trim() || (await clientNameFor(cal.group_key));

  return (
    <div className="min-h-screen bg-canvas">
      <div className="mx-auto max-w-4xl px-4 py-6 sm:py-8">
        {/* Cabeçalho da marca */}
        <div className="card mb-5 border-t-4 border-brand-blue p-5">
          <Image src="/brand/markseg-logo.png" alt="MarkSeg" width={104} height={30} className="mb-3" priority />
          <p className="text-xs font-bold uppercase tracking-wide text-brand-orange">Calendário editorial</p>
          <h1 className="mt-1 text-2xl font-bold text-ink">{clientName}</h1>
          <p className="mt-1 text-sm text-muted">
            {cal.title ? <span className="font-semibold capitalize text-ink">{cal.title}</span> : "Planejamento do mês"} ·
            visão geral dos conteúdos, formatos e datas.
          </p>
        </div>

        <CalendarView theme={cal.theme} posts={cal.posts} />

        <div className="mt-8 text-center text-xs text-muted">
          Gerado por <b>MarkSeg Studio</b> · studio.markseg.com.br
        </div>
      </div>
    </div>
  );
}
