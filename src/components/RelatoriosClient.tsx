"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Eye,
  Radar,
  Heart,
  Bookmark,
  Share2,
  TrendingUp,
  Users,
  MousePointerClick,
  Loader2,
  AlertCircle,
  ExternalLink,
  Sparkles,
  Link2,
  Copy,
  Check,
  ArrowUp,
  ArrowDown,
  FileBarChart,
} from "lucide-react";
import { REPORT_GENERATOR_URL } from "./Sidebar";
import type { SocialAccount } from "@/lib/types";
import type { AccountInsights } from "@/lib/insights";
import { buildClients } from "@/lib/clients";
import { fmtFollowers } from "@/lib/format";
import { PlatformIcon } from "./PlatformIcon";
import { TrendChart } from "./TrendChart";

const PERIODS = [
  { d: 7, label: "7d" },
  { d: 30, label: "30d" },
  { d: 90, label: "90d" },
];

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

function Metric({
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

export function RelatoriosClient({ accounts }: { accounts: SocialAccount[] }) {
  const clients = useMemo(() => buildClients(accounts), [accounts]);
  const [clientKey, setClientKey] = useState(clients[0]?.key ?? "");
  const [days, setDays] = useState(30);
  const [network, setNetwork] = useState<"all" | "instagram" | "facebook">("all");
  const [data, setData] = useState<AccountInsights | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const [copied, setCopied] = useState(false);

  const client = clients.find((c) => c.key === clientKey);
  const clientNetworks = useMemo(
    () =>
      [...new Set((client?.accounts ?? []).map((a) => a.platform))].filter(
        (p) => p === "instagram" || p === "facebook",
      ) as ("instagram" | "facebook")[],
    [client],
  );

  useEffect(() => {
    if (!clientKey) return;
    let cancel = false;
    setLoading(true);
    setError(null);
    setData(null);
    setShareUrl(null);
    fetch(`/api/insights?group=${encodeURIComponent(clientKey)}&days=${days}&network=${network}`)
      .then((r) => r.json())
      .then((j) => {
        if (cancel) return;
        if (j.error) setError(j.error);
        else setData(j.insights);
      })
      .catch((e) => !cancel && setError(e.message))
      .finally(() => !cancel && setLoading(false));
    return () => {
      cancel = true;
    };
  }, [clientKey, days, network]);

  async function share() {
    setSharing(true);
    setShareUrl(null);
    try {
      const res = await fetch("/api/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ group: clientKey, days, network }),
      });
      const j = await res.json();
      if (j.url) {
        setShareUrl(j.url);
        try {
          await navigator.clipboard.writeText(j.url);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {}
      }
    } finally {
      setSharing(false);
    }
  }

  if (clients.length === 0) {
    return (
      <div className="mx-auto max-w-4xl">
        <h1 className="font-display text-2xl font-bold text-ink">Reports &amp; Analytics</h1>
        <p className="mt-4 text-sm text-muted">Conecte uma conta primeiro pra ver os relatórios.</p>
      </div>
    );
  }

  const er = data?.engagementRate ?? 0;
  const erColor = er >= 3 ? "text-emerald-600" : er >= 1 ? "text-amber-600" : "text-rose-600";

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3 animate-rise">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink">Reports &amp; Analytics</h1>
          <p className="mt-1 text-sm text-muted">Relatório do cliente — todas as redes num lugar só.</p>
        </div>
        <a
          href={REPORT_GENERATOR_URL}
          target="_blank"
          rel="noreferrer"
          className="gradient-brand flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition-fluid hover:opacity-95"
        >
          <FileBarChart className="h-4 w-4" /> Gerador de relatórios <ExternalLink className="h-3.5 w-3.5 opacity-80" />
        </a>
      </div>

      {/* Controles */}
      <div className="space-y-3">
        <select
          value={clientKey}
          onChange={(e) => {
            setClientKey(e.target.value);
            setNetwork("all");
          }}
          className="w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm font-semibold text-ink outline-none focus:border-brand-blue"
        >
          {clients.map((c) => (
            <option key={c.key} value={c.key}>
              {c.name}
            </option>
          ))}
        </select>

        <div className="flex flex-wrap items-center gap-2">
          {/* Rede */}
          <div className="flex gap-1 rounded-xl bg-canvas p-1">
            <button
              onClick={() => setNetwork("all")}
              className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${network === "all" ? "bg-white text-ink shadow-sm" : "text-muted"}`}
            >
              Todas
            </button>
            {clientNetworks.map((p) => (
              <button
                key={p}
                onClick={() => setNetwork(p)}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold capitalize ${
                  network === p ? "bg-white text-ink shadow-sm" : "text-muted"
                }`}
              >
                <PlatformIcon platform={p} className="h-3.5 w-3.5" />
                {p === "instagram" ? "Instagram" : "Facebook"}
              </button>
            ))}
          </div>

          {/* Período */}
          <div className="flex gap-1 rounded-xl bg-canvas p-1">
            {PERIODS.map((pr) => (
              <button
                key={pr.d}
                onClick={() => setDays(pr.d)}
                className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${days === pr.d ? "bg-white text-ink shadow-sm" : "text-muted"}`}
              >
                {pr.label}
              </button>
            ))}
          </div>

          <button
            onClick={share}
            disabled={sharing || !clientKey}
            className="gradient-brand ml-auto flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white transition-fluid hover:opacity-95 disabled:opacity-50"
          >
            {sharing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" />}
            <span className="hidden sm:inline">Compartilhar com cliente</span>
            <span className="sm:hidden">Compartilhar</span>
          </button>
        </div>
      </div>

      {shareUrl && (
        <div className="card flex flex-wrap items-center gap-3 border-brand-blue/30 bg-brand-blue-50/40 p-4 animate-rise">
          <Link2 className="h-5 w-5 shrink-0 text-brand-blue" />
          <a
            href={shareUrl}
            target="_blank"
            rel="noreferrer"
            className="min-w-0 flex-1 truncate text-sm font-semibold text-brand-blue-700 underline"
          >
            {shareUrl}
          </a>
          <button
            onClick={() => {
              navigator.clipboard.writeText(shareUrl);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
            className="flex items-center gap-1.5 rounded-lg border border-line bg-white px-3 py-1.5 text-xs font-semibold text-ink"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? "Copiado!" : "Copiar"}
          </button>
        </div>
      )}

      {loading && (
        <div className="card grid place-items-center gap-2 p-16 text-muted">
          <Loader2 className="h-6 w-6 animate-spin text-brand-blue" />
          <span className="text-sm">Puxando os números da Meta…</span>
        </div>
      )}

      {error && !loading && (
        <div className="card flex items-start gap-3 p-5 text-rose-700">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
          <div className="text-sm">
            <p className="font-semibold">Não consegui buscar os dados.</p>
            <p className="mt-1 text-rose-600">{error}</p>
          </div>
        </div>
      )}

      {data && !loading && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Metric label="Alcance / entrega" value={fmtFollowers(data.reach)} icon={Radar} accent="blue" delta={data.delta.reach} />
            <Metric label="Visualizações" value={fmtFollowers(data.views)} icon={Eye} accent="blue" delta={data.delta.views} />
            <div className="rounded-2xl border border-brand-orange/15 bg-brand-orange-50/50 p-4 shadow-card">
              <div className="flex items-center justify-between">
                <span className="gradient-orange grid h-9 w-9 place-items-center rounded-xl text-white">
                  <Sparkles className="h-4 w-4" strokeWidth={2.4} />
                </span>
                <span className="rounded-full bg-white/70 px-2 py-0.5 text-[11px] font-bold text-muted">meta &gt;3%</span>
              </div>
              <div className={`mt-3 font-display text-2xl font-bold sm:text-3xl ${erColor}`}>
                {data.engagementRate.toFixed(1)}%
              </div>
              <div className="text-xs font-medium text-muted">Engajamento</div>
            </div>
            <Metric label="Seguidores" value={fmtFollowers(data.followers)} icon={Users} accent="green" delta={data.delta.followers} />
            <Metric label="Interações" value={fmtFollowers(data.interactions)} icon={Heart} accent="orange" delta={data.delta.interactions} />
            <Metric label="Salvamentos" value={fmtFollowers(data.saves)} icon={Bookmark} accent="blue" />
            <Metric label="Compartilhamentos" value={fmtFollowers(data.shares)} icon={Share2} accent="blue" />
            <Metric label="Visitas no perfil" value={fmtFollowers(data.profileVisits)} icon={MousePointerClick} accent="orange" />
          </div>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
            <section className="card p-5 lg:col-span-2">
              <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-bold text-ink">
                <TrendingUp className="h-5 w-5 text-brand-blue" /> Alcance ao longo do período
              </h2>
              <TrendChart data={data.trend} />
            </section>

            <section className="card p-5">
              <h2 className="mb-4 font-display text-lg font-bold text-ink">Melhores publicações</h2>
              <div className="space-y-3">
                {data.topPosts.length === 0 ? (
                  <p className="text-sm text-muted">Sem publicações no período.</p>
                ) : (
                  data.topPosts.slice(0, 5).map((p) => (
                    <a
                      key={p.id}
                      href={p.permalink || "#"}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-3 rounded-xl border border-line p-2 transition-fluid hover:border-brand-blue/30"
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
    </div>
  );
}
