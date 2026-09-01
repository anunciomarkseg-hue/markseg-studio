"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Send, Trash2, Loader2, CheckCircle2, AlertCircle, CalendarClock, X } from "lucide-react";
import { STATUS_LABEL, type PostStatus, type ScheduledPost, type SocialAccount } from "@/lib/types";
import { PostListItem } from "@/components/PostListItem";
import { acompanharPost } from "@/lib/postStatus";
import { dateInputValue, fmtDayTime, timeInputValue } from "@/lib/format";

type Filter = "todas" | PostStatus;
const FILTERS: Filter[] = ["todas", "agendado", "aguardando", "publicado", "rascunho", "falhou"];

export function PublicacoesClient({
  posts,
  accounts,
}: {
  posts: ScheduledPost[];
  accounts: SocialAccount[];
}) {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>("todas");
  const [busy, setBusy] = useState<{
    id: string;
    action: "publish" | "delete" | "republish" | "reschedule";
  } | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  /** post aberto pra reagendar + os campos de data/hora em edição */
  const [reagendando, setReagendando] = useState<{ id: string; date: string; time: string } | null>(
    null,
  );

  const list = posts
    .filter((p) => filter === "todas" || p.status === filter)
    .sort((a, b) => +new Date(b.scheduledFor) - +new Date(a.scheduledFor));

  const count = (f: Filter) =>
    f === "todas" ? posts.length : posts.filter((p) => p.status === f).length;

  /** Envia e, se a resposta se perder (corte por tempo), confere o estado REAL
   *  do post em vez de dizer que falhou — o post costuma ter saído. */
  async function enviar(id: string, rota: "publish" | "republish", verbo: string) {
    setMsg(null);
    setBusy({ id, action: rota === "publish" ? "publish" : "republish" });
    try {
      let data: Record<string, unknown> = {};
      let cortado = false;
      try {
        const res = await fetch(`/api/posts/${id}/${rota}`, { method: "POST" });
        const text = await res.text();
        try {
          data = text ? JSON.parse(text) : {};
        } catch {
          cortado = true; // resposta não-JSON = função cortada por tempo
        }
        if (!res.ok && !cortado) throw new Error((data.error as string) ?? `Falha ao ${verbo}`);
      } catch (e) {
        if (!cortado) {
          if (e instanceof TypeError) cortado = true; // rede caiu no meio
          else throw e;
        }
      }

      if (cortado) {
        setMsg({ ok: true, text: "Finalizando a publicação… conferindo o resultado." });
        const info = await acompanharPost(id);
        if (info && (info.publicados ?? 0) > 0) {
          setMsg({ ok: true, text: `Publicado em ${info.publicados} conta(s)! 🎉${info.falhou ? ` (${info.falhou} falharam)` : ""}` });
        } else if (info?.falhou) {
          setMsg({ ok: false, text: `Não publicou: ${info.primeiroErro ?? "falhou"}` });
        } else {
          setMsg({
            ok: true,
            text: "O vídeo ainda está sendo finalizado pelo Instagram (normal). Não publique de novo — atualize em alguns minutos.",
          });
        }
        router.refresh();
        return;
      }

      const publicados = Number(data.published ?? 0);
      if (publicados > 0) {
        setMsg({ ok: true, text: `Publicado em ${publicados} conta(s)! 🎉${data.failed ? ` (${data.failed} falharam)` : ""}` });
      } else {
        const det = data.details as { error?: string }[] | undefined;
        setMsg({ ok: false, text: `Não publicou: ${det?.find((d) => d.error)?.error ?? "falhou"}` });
      }
      router.refresh();
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(null);
    }
  }

  async function publishNow(id: string) {
    if (
      !window.confirm(
        "PUBLICAR AGORA, AO VIVO?\n\nIsso posta DE VERDADE na(s) conta(s) selecionada(s) — fica visível pros seguidores. Confirmar?",
      )
    )
      return;
    await enviar(id, "publish", "publicar");
  }

  async function republish(id: string) {
    if (
      !window.confirm(
        "REPUBLICAR este post?\n\nReenvia só o que NÃO saiu (o que já foi publicado não duplica). Confirmar?",
      )
    )
      return;
    await enviar(id, "republish", "republicar");
  }

  async function del(id: string, isPublished: boolean) {
    const q = isPublished
      ? "APAGAR este post?\n\n• Facebook e LinkedIn: apagamos NA REDE também.\n• Instagram e TikTok: a API não permite apagar — precisa remover pelo app.\n\nO registro sai daqui do sistema. Confirmar?"
      : "Excluir esta publicação? (não dá pra desfazer)";
    if (!window.confirm(q)) return;
    setMsg(null);
    setBusy({ id, action: "delete" });
    try {
      const res = await fetch(`/api/posts/${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Falha ao excluir");

      const parts: string[] = ["Publicação excluída."];
      if (data.removedRemote > 0) parts.push(`Apagada na rede em ${data.removedRemote} conta(s). ✅`);
      if (data.manual?.length)
        parts.push(`⚠️ ${data.manual.join(" e ")} não permite(m) apagar pela API — remova pelo app.`);
      if (data.failures?.length) parts.push(`Falhou: ${data.failures.join("; ")}`);
      setMsg({ ok: !data.failures?.length, text: parts.join(" ") });
      router.refresh();
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(null);
    }
  }

  /** Abre/fecha o painel de nova data, já preenchido com o agendamento atual. */
  function toggleReagendar(post: ScheduledPost) {
    setMsg(null);
    setReagendando((atual) =>
      atual?.id === post.id
        ? null
        : {
            id: post.id,
            date: dateInputValue(post.scheduledFor),
            time: timeInputValue(post.scheduledFor),
          },
    );
  }

  /** Salva a nova data/hora do agendamento (só antes de o post sair). */
  async function salvarNovaData() {
    if (!reagendando) return;
    const { id, date, time } = reagendando;
    if (!date || !time) {
      setMsg({ ok: false, text: "Preencha a data e a hora." });
      return;
    }
    // Fuso LOCAL de propósito: o campo mostra a hora do Brasil e o servidor
    // guarda o instante em UTC. Montar por string evitaria isso e empurraria
    // a publicação pra outro horário.
    const quando = new Date(`${date}T${time}`);
    if (Number.isNaN(quando.getTime())) {
      setMsg({ ok: false, text: "Data ou hora inválida." });
      return;
    }
    if (quando.getTime() < Date.now()) {
      setMsg({ ok: false, text: "Escolha uma data no futuro (pra publicar já, use 'Publicar agora')." });
      return;
    }

    setMsg(null);
    setBusy({ id, action: "reschedule" });
    try {
      const res = await fetch(`/api/posts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scheduledFor: quando.toISOString() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Falha ao reagendar");

      const label = quando.toLocaleDateString("pt-BR", {
        weekday: "long",
        day: "2-digit",
        month: "long",
      });
      setMsg({
        ok: true,
        text: `Reagendado para ${label} às ${time}.${data.requeued ? " O post voltou para a fila e será enviado nessa nova data." : ""}`,
      });
      setReagendando(null);
      router.refresh();
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 animate-rise">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink">Publicações</h1>
          <p className="mt-1 text-sm text-muted">Tudo que já foi criado, agendado e publicado.</p>
        </div>
        <Link href="/publicar" className="gradient-brand flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-card transition-fluid hover:opacity-95 hover:shadow-pop">
          <Plus className="h-4 w-4" strokeWidth={2.6} /> Nova publicação
        </Link>
      </div>

      {msg && (
        <div
          className={`mb-5 flex items-center gap-3 rounded-2xl border p-4 text-sm font-medium animate-rise ${
            msg.ok
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-rose-200 bg-rose-50 text-rose-700"
          }`}
        >
          {msg.ok ? <CheckCircle2 className="h-5 w-5 shrink-0" /> : <AlertCircle className="h-5 w-5 shrink-0" />}
          {msg.text}
        </div>
      )}

      <div className="mb-5 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`flex items-center gap-2 rounded-full px-3.5 py-1.5 text-sm font-semibold capitalize transition-fluid ${
              filter === f ? "bg-ink text-white" : "border border-line bg-surface text-muted hover:text-ink"
            }`}
          >
            {f === "todas" ? "Todas" : STATUS_LABEL[f]}
            <span className={`rounded-full px-1.5 text-xs ${filter === f ? "bg-white/20" : "bg-canvas"}`}>
              {count(f)}
            </span>
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {list.length === 0 ? (
          <div className="card grid place-items-center p-12 text-center text-sm text-muted">
            Nenhuma publicação nesse filtro.{" "}
            <Link href="/publicar" className="ml-1 font-semibold text-brand-blue">
              Criar uma →
            </Link>
          </div>
        ) : (
          list.map((p) => {
            const isBusy = busy?.id === p.id;
            const aberto = reagendando?.id === p.id;
            return (
              <div key={p.id} className="space-y-2">
                <PostListItem post={p} accounts={accounts} />
                <div className="flex items-center justify-end gap-2 px-1">
                  {p.status !== "publicado" && (
                    <button
                      onClick={() => toggleReagendar(p)}
                      disabled={isBusy}
                      title="Mudar a data/hora do agendamento (antes de o post sair)"
                      className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-fluid disabled:opacity-50 ${
                        aberto
                          ? "border-brand-blue bg-brand-blue-50 text-brand-blue-700"
                          : "border-line text-ink hover:bg-canvas"
                      }`}
                    >
                      {aberto ? <X className="h-3.5 w-3.5" /> : <CalendarClock className="h-3.5 w-3.5" />}
                      {aberto ? "Cancelar" : "Reagendar"}
                    </button>
                  )}
                  {p.status !== "publicado" && (
                    <button
                      onClick={() => publishNow(p.id)}
                      disabled={isBusy}
                      className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition-fluid hover:bg-emerald-700 disabled:opacity-50"
                    >
                      {isBusy && busy?.action === "publish" ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Send className="h-3.5 w-3.5" />
                      )}
                      Publicar agora
                    </button>
                  )}
                  {(p.status === "publicado" || p.status === "falhou") && (
                    <button
                      onClick={() => republish(p.id)}
                      disabled={isBusy}
                      title="Reenvia só o que não saiu (não duplica)"
                      className="flex items-center gap-1.5 rounded-lg border border-brand-blue px-3 py-1.5 text-xs font-semibold text-brand-blue-700 transition-fluid hover:bg-brand-blue-50 disabled:opacity-50"
                    >
                      {isBusy && busy?.action === "republish" ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Send className="h-3.5 w-3.5" />
                      )}
                      Republicar
                    </button>
                  )}
                  <button
                    onClick={() => del(p.id, p.status === "publicado")}
                    disabled={isBusy}
                    className="flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-rose-600 transition-fluid hover:bg-rose-50 disabled:opacity-50"
                  >
                    {isBusy && busy?.action === "delete" ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}
                    {p.status === "publicado" ? "Apagar post" : "Excluir"}
                  </button>
                </div>

                {aberto && reagendando && (
                  <div className="rounded-2xl border border-brand-blue/30 bg-brand-blue-50/40 p-4 animate-rise">
                    <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink">
                      <CalendarClock className="h-4 w-4 text-brand-blue" /> Nova data do agendamento
                    </p>
                    <div className="flex flex-wrap items-center gap-3">
                      <input
                        type="date"
                        value={reagendando.date}
                        min={dateInputValue(new Date().toISOString())}
                        onChange={(e) =>
                          setReagendando({ ...reagendando, date: e.target.value })
                        }
                        className="rounded-xl border border-line bg-white px-3 py-2.5 text-sm text-ink outline-none focus:border-brand-blue"
                      />
                      <input
                        type="time"
                        value={reagendando.time}
                        onChange={(e) =>
                          setReagendando({ ...reagendando, time: e.target.value })
                        }
                        className="rounded-xl border border-line bg-white px-3 py-2.5 text-sm text-ink outline-none focus:border-brand-blue"
                      />
                      <button
                        onClick={salvarNovaData}
                        disabled={isBusy}
                        className="gradient-brand flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-card transition-fluid hover:opacity-95 disabled:opacity-50"
                      >
                        {isBusy && busy?.action === "reschedule" ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <CalendarClock className="h-4 w-4" />
                        )}
                        Salvar nova data
                      </button>
                    </div>
                    <p className="mt-2 text-xs text-muted">
                      Agendado hoje para <b>{fmtDayTime(p.scheduledFor)}</b>. A troca vale só
                      enquanto o post não saiu.
                      {p.status === "falhou" &&
                        " Como ele falhou, vai voltar para a fila e ser reenviado nessa nova data (o que já publicou não duplica)."}
                    </p>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
