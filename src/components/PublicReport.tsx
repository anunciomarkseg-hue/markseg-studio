import Image from "next/image";
import {
  Radar,
  Eye,
  Sparkles,
  Heart,
  Bookmark,
  Share2,
  Users,
  MousePointerClick,
  TrendingUp,
  ExternalLink,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import type { AccountInsights } from "@/lib/insights";
import { fmtFollowers } from "@/lib/format";
import { PlatformIcon } from "./PlatformIcon";
import { TrendChart } from "./TrendChart";
import { PrintButton } from "./PrintButton";

function DeltaBadge({ delta }: { delta?: number | null }) {
  if (typeof delta !== "number") return null;
  const up = delta >= 0;
  return (
    <span
      className={`flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-bold ${
        up ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-600"
      }`}
    >
      {up ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
      {Math.abs(delta)}%
    </span>
  );
}

function Card({
  label,
  value,
  icon: Icon,
  accent = "blue",
  delta,
}: {
  label: string;
  value: string;
  icon: React.ElementType;
  accent?: "blue" | "orange" | "green";
  delta?: number | null;
}) {
  const cfg = {
    blue: { card: "border-brand-blue/15 bg-brand-blue-50/40", ic: "gradient-blue text-white" },
    orange: { card: "border-brand-orange/15 bg-brand-orange-50/50", ic: "gradient-orange text-white" },
    green: { card: "border-emerald-200 bg-emerald-50/50", ic: "bg-emerald-500 text-white" },
  }[accent];
  return (
    <div className={`rounded-2xl border p-4 shadow-card ${cfg.card}`}>
      <div className="flex items-center justify-between">
        <span className={`grid h-9 w-9 place-items-center rounded-xl ${cfg.ic}`}>
          <Icon className="h-4 w-4" strokeWidth={2.4} />
        </span>
        <DeltaBadge delta={delta} />
      </div>
      <div className="mt-3 font-display text-2xl font-bold text-ink sm:text-3xl">{value}</div>
      <div className="text-xs font-medium text-muted">{label}</div>
    </div>
  );
}

export function PublicReport({
  name,
  days,
  insights,
}: {
  name: string;
  days: number;
  insights: AccountInsights | null;
}) {
  const er = insights?.engagementRate ?? 0;
  const erColor = er >= 3 ? "text-emerald-600" : er >= 1 ? "text-amber-600" : "text-rose-600";
  const networks = insights?.networks ?? [];

  return (
    <div className="min-h-screen bg-canvas">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-5 sm:py-8">
        <div className="card mb-5 flex flex-wrap items-center justify-between gap-4 p-5">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-display text-xl font-bold text-ink">{name}</span>
              <span className="flex items-center gap-1">
                {networks.includes("instagram") && (
                  <PlatformIcon platform="instagram" className="h-4 w-4 text-brand-orange" />
                )}
                {networks.includes("facebook") && (
                  <PlatformIcon platform="facebook" className="h-4 w-4 text-brand-blue" />
                )}
              </span>
            </div>
            <div className="text-xs text-muted">Relatório de desempenho · últimos {days} dias</div>
          </div>
          <div className="flex items-center gap-3">
            <Image src="/brand/markseg-logo.png" alt="MarkSeg" width={120} height={35} priority />
            <PrintButton />
          </div>
        </div>

        {!insights ? (
          <div className="card p-8 text-center text-sm text-muted">
            Não foi possível carregar os dados deste relatório no momento.
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Card label="Alcance / entrega" value={fmtFollowers(insights.reach)} icon={Radar} delta={insights.delta.reach} />
              <Card label="Visualizações" value={fmtFollowers(insights.views)} icon={Eye} delta={insights.delta.views} />
              <div className="rounded-2xl border border-brand-orange/15 bg-brand-orange-50/50 p-4 shadow-card">
                <div className="flex items-center justify-between">
                  <span className="gradient-orange grid h-9 w-9 place-items-center rounded-xl text-white">
                    <Sparkles className="h-4 w-4" strokeWidth={2.4} />
                  </span>
                  <span className="rounded-full bg-white/70 px-2 py-0.5 text-[11px] font-bold text-muted">meta &gt;3%</span>
                </div>
                <div className={`mt-3 font-display text-2xl font-bold sm:text-3xl ${erColor}`}>
                  {insights.engagementRate.toFixed(1)}%
                </div>
                <div className="text-xs font-medium text-muted">Engajamento</div>
              </div>
              <Card label="Seguidores" value={fmtFollowers(insights.followers)} icon={Users} accent="green" delta={insights.delta.followers} />
              <Card label="Interações" value={fmtFollowers(insights.interactions)} icon={Heart} accent="orange" delta={insights.delta.interactions} />
              <Card label="Salvamentos" value={fmtFollowers(insights.saves)} icon={Bookmark} />
              <Card label="Compartilhamentos" value={fmtFollowers(insights.shares)} icon={Share2} />
              <Card label="Visitas no perfil" value={fmtFollowers(insights.profileVisits)} icon={MousePointerClick} accent="orange" />
            </div>

            <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-3">
              <section className="card p-5 lg:col-span-2">
                <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-bold text-ink">
                  <TrendingUp className="h-5 w-5 text-brand-blue" /> Alcance ao longo do período
                </h2>
                <TrendChart data={insights.trend} />
              </section>

              <section className="card p-5">
                <h2 className="mb-4 font-display text-lg font-bold text-ink">Melhores publicações</h2>
                <div className="space-y-3">
                  {insights.topPosts.length === 0 ? (
                    <p className="text-sm text-muted">Sem publicações no período.</p>
                  ) : (
                    insights.topPosts.slice(0, 5).map((p) => (
                      <a
                        key={p.id}
                        href={p.permalink || "#"}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-3 rounded-xl border border-line p-2"
                      >
                        {p.thumb ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={p.thumb} alt="" className="h-12 w-12 shrink-0 rounded-lg object-cover" />
                        ) : (
                          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-canvas">
                            <PlatformIcon platform={p.platform} className="h-5 w-5 text-muted" />
                          </span>
                        )}
                        <span className="min-w-0 flex-1">
                          <span className="mb-0.5 flex items-center gap-1.5">
                            <PlatformIcon
                              platform={p.platform}
                              className={`h-3 w-3 shrink-0 ${p.platform === "instagram" ? "text-brand-orange" : "text-brand-blue"}`}
                            />
                            <span className="min-w-0 flex-1 truncate text-xs text-slate-600">{p.caption || "(sem legenda)"}</span>
                          </span>
                          <span className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] font-semibold">
                            <span className="text-brand-blue">{fmtFollowers(p.reach)} alcance</span>
                            {p.interactions > 0 && (
                              <span className="text-brand-orange">{fmtFollowers(p.interactions)} interações</span>
                            )}
                          </span>
                        </span>
                        <ExternalLink className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                      </a>
                    ))
                  )}
                </div>
              </section>
            </div>
          </>
        )}

        <div className="mt-8 text-center text-xs text-muted">
          Gerado por <span className="font-semibold text-ink">MarkSeg Studio</span> · studio.markseg.com.br
        </div>
      </div>
    </div>
  );
}
