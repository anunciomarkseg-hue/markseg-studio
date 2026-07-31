import Link from "next/link";
import {
  CalendarClock,
  Clock3,
  CheckCircle2,
  Users,
  Plus,
  ArrowRight,
  AlertTriangle,
} from "lucide-react";
import { listAccounts, listPosts } from "@/lib/db";
import { listPendingScheduling, listPendingAjustes, type EditorialPost } from "@/lib/editorial";
import { MessageSquare } from "lucide-react";
import { getActiveGroup } from "@/lib/active";
import { buildClients, accountIdsForGroup } from "@/lib/clients";
import { fmtFollowers } from "@/lib/format";
import type { ScheduledPost, SocialAccount } from "@/lib/types";
import { StatCard } from "@/components/StatCard";
import { PostListItem } from "@/components/PostListItem";
import { Avatar } from "@/components/Avatar";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  let accounts: SocialAccount[] = [];
  let allPosts: ScheduledPost[] = [];
  let pending: EditorialPost[] = [];
  let ajustes: EditorialPost[] = [];
  try {
    [accounts, allPosts, pending, ajustes] = await Promise.all([
      listAccounts(),
      listPosts(),
      listPendingScheduling(),
      listPendingAjustes(),
    ]);
  } catch {
    // se o banco falhar, mostra vazio em vez de quebrar
  }

  const ajustesClients = new Set(ajustes.map((p) => p.group_key)).size;
  const aprovadosClients = new Set(pending.map((p) => p.group_key)).size;

  const activeGroup = await getActiveGroup();
  const activeClient = activeGroup
    ? (buildClients(accounts).find((c) => c.key === activeGroup) ?? null)
    : null;
  const groupIds = accountIdsForGroup(accounts, activeGroup);

  const posts = activeGroup
    ? allPosts.filter((p) => p.accountIds.some((id) => groupIds.includes(id)))
    : allPosts;
  const panelAccounts = activeClient ? activeClient.accounts : accounts;

  const agendadas = posts.filter((p) => p.status === "agendado");
  const aguardando = posts.filter((p) => p.status === "aguardando");
  const publicadas = posts.filter((p) => p.status === "publicado");

  const proximas = posts
    .filter((p) => p.status === "agendado" || p.status === "aguardando")
    .sort((a, b) => +new Date(a.scheduledFor) - +new Date(b.scheduledFor))
    .slice(0, 5);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-wrap items-end justify-between gap-4 animate-rise">
        <div>
          <span className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-brand-blue-50 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-brand-blue-700">
            Ferramenta interna · MarkSeg
          </span>
          <h1 className="font-display text-2xl font-bold text-ink">Olá, Rafa 👋</h1>
          <p className="mt-1 text-sm text-muted">
            {activeClient ? (
              <>
                Focado no cliente <span className="font-semibold text-ink">{activeClient.name}</span>. (Troque
                no topo.)
              </>
            ) : (
              <>
                Resumo de <span className="font-semibold text-ink">todos os clientes</span>. Escolha um no topo
                pra focar.
              </>
            )}
          </p>
        </div>
        <Link
          href="/publicar"
          className="gradient-brand flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-card transition-fluid hover:opacity-95 hover:shadow-pop"
        >
          <Plus className="h-4 w-4" strokeWidth={2.6} />
          Nova publicação
        </Link>
      </div>

      {/* Alerta: ajustes pedidos pelo cliente */}
      {ajustes.length > 0 && (
        <Link
          href="/pauta"
          className="flex items-center gap-3 rounded-2xl border border-rose-300 bg-rose-50 p-4 transition-fluid hover:bg-rose-100 animate-rise"
        >
          <MessageSquare className="h-5 w-5 shrink-0 text-rose-600" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-rose-900">
              {ajustes.length} post{ajustes.length > 1 ? "s" : ""}
              {ajustesClients > 0 ? ` de ${ajustesClients} cliente${ajustesClients > 1 ? "s" : ""}` : ""} com ajuste pedido
            </p>
            <p className="text-xs text-rose-800">Toque pra ver os comentários na Pauta.</p>
          </div>
          <ArrowRight className="h-4 w-4 shrink-0 text-rose-700" />
        </Link>
      )}

      {/* Alerta geral: posts aprovados que precisam ser agendados (todos os clientes) */}
      {pending.length > 0 && (
        <Link
          href="/pauta"
          className="flex items-center gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 transition-fluid hover:bg-amber-100 animate-rise"
        >
          <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-amber-900">
              {pending.length} post{pending.length > 1 ? "s" : ""} aprovado{pending.length > 1 ? "s" : ""}
              {aprovadosClients > 0 ? ` de ${aprovadosClients} cliente${aprovadosClients > 1 ? "s" : ""}` : ""} pra agendar
            </p>
            <p className="text-xs text-amber-800">Toque pra ver na Pauta e agendar.</p>
          </div>
          <ArrowRight className="h-4 w-4 shrink-0 text-amber-700" />
        </Link>
      )}

      {/* Métricas */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="Agendadas" value={agendadas.length} icon={CalendarClock} accent="blue" />
        <StatCard label="Aguardando aprovação" value={aguardando.length} icon={Clock3} accent="orange" />
        <StatCard label="Publicadas" value={publicadas.length} icon={CheckCircle2} accent="green" />
        <StatCard
          label={activeClient ? "Contas do cliente" : "Contas conectadas"}
          value={activeClient ? activeClient.accounts.length : accounts.length}
          icon={Users}
          accent="blue"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Próximas publicações */}
        <section className="card p-5 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-lg font-bold text-ink">Próximas publicações</h2>
            <Link
              href="/publicacoes"
              className="flex items-center gap-1 text-sm font-semibold text-brand-blue hover:text-brand-blue-700"
            >
              Ver todas <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="space-y-3">
            {proximas.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-line p-8 text-center text-sm text-muted">
                Nenhuma publicação agendada ainda.{" "}
                <Link href="/publicar" className="font-semibold text-brand-blue">
                  Criar a primeira →
                </Link>
              </div>
            ) : (
              proximas.map((p) => <PostListItem key={p.id} post={p} accounts={accounts} />)
            )}
          </div>
        </section>

        {/* Contas */}
        <section className="card h-fit p-5">
          <h2 className="mb-4 font-display text-lg font-bold text-ink">
            {activeClient ? "Contas do cliente" : "Suas contas"}
          </h2>
          <div className="max-h-80 space-y-3 overflow-y-auto">
            {panelAccounts.map((a) => (
              <div key={a.id} className="flex items-center gap-3">
                <Avatar account={a} size={42} />
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-ink">{a.handle}</div>
                  <div className="text-xs text-muted">{fmtFollowers(a.followers)} seguidores</div>
                </div>
              </div>
            ))}
          </div>
          <Link
            href="/contas"
            className="mt-4 flex items-center justify-center gap-2 rounded-xl border border-dashed border-brand-blue/40 px-4 py-2.5 text-sm font-semibold text-brand-blue transition-fluid hover:bg-brand-blue-50"
          >
            <Plus className="h-4 w-4" /> Gerenciar contas
          </Link>
        </section>
      </div>
    </div>
  );
}
