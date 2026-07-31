"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Pin,
  PinOff,
  Trash2,
  Send,
  Loader2,
  Download,
  MessageCircle,
  AlertTriangle,
  Check,
  CheckCircle2,
  Eye,
  Receipt,
} from "lucide-react";
import { useAutoUpdate } from "@/lib/useAutoUpdate";
import { usePush } from "@/lib/usePush";
import { PushBell } from "@/components/PushBell";
import { ensureAudioUnlock, playChime } from "@/lib/sound";
import { MuralBanner } from "@/components/MuralBanner";
import type { MuralMessage } from "@/lib/mural";

type Ident = { name: string; role: string };

/** Formulário de lançamento de despesas/reembolsos (Google Apps Script). */
const EXPENSE_URL =
  "https://script.google.com/macros/s/AKfycbwUt8OfpnwiCNTtySogSRR1OwQ9kOHog10poQqkD_CSuTjSxbpDa2mff_MN5pNPDKN6/exec";

/** Cores de destaque (barra do topo do card) — dentro da paleta da marca + apoios. */
const COLORS = [
  { edge: "#1c6fce", soft: "#eaf3fd" }, // azul MarkSeg
  { edge: "#f26a2c", soft: "#fef2ea" }, // laranja MarkSeg
  { edge: "#15a06b", soft: "#e7f6ef" }, // verde ok
  { edge: "#e8920c", soft: "#fdf3e0" }, // âmbar
  { edge: "#8B5CF6", soft: "#f1ecfd" }, // roxo
  { edge: "#e0483d", soft: "#fdecea" }, // vermelho
];

const LONG = 300; // acima disso, o card colapsa com "Ler mais"

const fmt = (iso: string) =>
  new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
const fmtLong = (iso: string) =>
  new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

/** Transforma URLs do texto em links clicáveis. */
function Linkified({ text }: { text: string }) {
  const parts = text.split(/(https?:\/\/[^\s]+|www\.[^\s]+)/gi);
  return (
    <>
      {parts.map((p, i) => {
        if (/^(https?:\/\/|www\.)/i.test(p)) {
          const href = p.startsWith("http") ? p : `https://${p}`;
          return (
            <a
              key={i}
              href={href}
              target="_blank"
              rel="noreferrer"
              className="break-all font-semibold text-brand-blue underline decoration-brand-blue/40 hover:text-brand-blue-700"
            >
              {p}
            </a>
          );
        }
        return <span key={i}>{p}</span>;
      })}
    </>
  );
}

export function MuralClient({ initial, isTeam }: { initial: MuralMessage[]; isTeam: boolean }) {
  const [items, setItems] = useState(initial);
  const [title, setTitle] = useState("");
  const [name, setName] = useState("");
  const [text, setText] = useState("");
  const [color, setColor] = useState(0);
  const [urgent, setUrgent] = useState(false);
  const [pinNew, setPinNew] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [reader, setReader] = useState<Ident | null>(null);
  const [pendingReadId, setPendingReadId] = useState<string | null>(null);
  const [identForm, setIdentForm] = useState<Ident>({ name: "", role: "" });
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [openReads, setOpenReads] = useState<Record<string, boolean>>({});

  const composing = useRef(false);
  const cid = useRef<string>("");
  const nameRef = useRef("");
  const seen = useRef<Set<string>>(new Set(initial.map((m) => m.id)));

  useAutoUpdate(composing);
  const push = usePush(() => ({ clientId: cid.current, name: nameRef.current || null }));

  useEffect(() => {
    nameRef.current = name;
  }, [name]);

  // PWA: registra o service worker + captura o convite de instalação
  const [installEvt, setInstallEvt] = useState<null | { prompt: () => void; userChoice: Promise<unknown> }>(null);
  useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
    const onBIP = (e: Event) => {
      e.preventDefault();
      setInstallEvt(e as unknown as { prompt: () => void; userChoice: Promise<unknown> });
    };
    window.addEventListener("beforeinstallprompt", onBIP);
    return () => window.removeEventListener("beforeinstallprompt", onBIP);
  }, []);

  useEffect(() => {
    ensureAudioUnlock();
    try {
      let id = localStorage.getItem("feed_cid");
      if (!id) {
        id = crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2);
        localStorage.setItem("feed_cid", id);
      }
      cid.current = id;
    } catch {
      cid.current = String(Date.now());
    }
    // identidade (nome+cargo) — a mesma do cadastro rápido das Conversas
    let fm: Ident | null = null;
    try {
      fm = JSON.parse(localStorage.getItem("feed_me") || "null");
    } catch {
      fm = null;
    }
    if (fm?.name) setReader(fm);
    const savedName = localStorage.getItem("mural_name");
    const initName = savedName || fm?.name || "";
    if (initName) {
      setName(initName);
      nameRef.current = initName;
    }
  }, []);

  useEffect(() => {
    const t = setInterval(async () => {
      if (composing.current) return;
      try {
        const r = await fetch("/api/mural", { cache: "no-store" });
        const d = await r.json();
        if (!Array.isArray(d.messages)) return;
        const list = d.messages as MuralMessage[];
        const hasNew = list.some((m) => !seen.current.has(m.id) && !m.urgent && m.author !== nameRef.current);
        if (hasNew) playChime("msg");
        seen.current = new Set(list.map((m) => m.id));
        setItems(list);
      } catch {
        /* ignora */
      }
    }, 20000);
    return () => clearInterval(t);
  }, []);

  async function post() {
    const message = text.trim();
    if (!message) return;
    setBusy(true);
    setErr(null);
    localStorage.setItem("mural_name", name.trim());
    try {
      const r = await fetch("/api/mural", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim() || null,
          author: name.trim() || null,
          message,
          color,
          urgent,
          pinned: pinNew,
          clientId: cid.current,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Erro ao colar o recado");
      seen.current.add(d.message.id);
      setItems((prev) => [d.message, ...prev]);
      setTitle("");
      setText("");
      setUrgent(false);
      setPinNew(false);
      setColor((c) => (c + 1) % COLORS.length);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function del(id: string) {
    if (!window.confirm("Apagar esse recado?")) return;
    setItems((prev) => prev.filter((m) => m.id !== id));
    await fetch(`/api/mural/${id}`, { method: "DELETE" }).catch(() => {});
  }

  async function pin(id: string, pinned: boolean) {
    setItems((prev) =>
      [...prev.map((m) => (m.id === id ? { ...m, pinned } : m))].sort(
        (a, b) => Number(b.pinned) - Number(a.pinned) || +new Date(b.created_at) - +new Date(a.created_at),
      ),
    );
    await fetch(`/api/mural/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pinned }),
    }).catch(() => {});
  }

  const myRead = (m: MuralMessage) => m.reads.some((r) => r.reader_id === cid.current);

  async function doConfirm(id: string, who: Ident) {
    // otimista
    setItems((prev) =>
      prev.map((m) =>
        m.id === id
          ? {
              ...m,
              reads: [
                ...m.reads.filter((r) => r.reader_id !== cid.current),
                { reader_id: cid.current, reader_name: who.name, reader_role: who.role || null, created_at: new Date().toISOString() },
              ],
            }
          : m,
      ),
    );
    try {
      const r = await fetch(`/api/mural/${id}/read`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId: cid.current, name: who.name, role: who.role || null }),
      });
      const d = await r.json();
      if (r.ok && Array.isArray(d.reads)) {
        setItems((prev) => prev.map((m) => (m.id === id ? { ...m, reads: d.reads } : m)));
      }
    } catch {
      /* ignora — o otimista já marcou */
    }
  }

  function confirmRead(m: MuralMessage) {
    if (myRead(m)) return;
    if (!reader?.name) {
      setIdentForm({ name: name.trim(), role: "" });
      setPendingReadId(m.id);
      return;
    }
    doConfirm(m.id, reader);
  }

  function saveIdentityAndConfirm() {
    const nm = identForm.name.trim();
    if (!nm) return;
    const who = { name: nm, role: identForm.role.trim() };
    localStorage.setItem("feed_me", JSON.stringify(who));
    setReader(who);
    const id = pendingReadId;
    setPendingReadId(null);
    if (id) doConfirm(id, who);
    // já oferece os avisos junto (pra ninguém esquecer de ligar)
    if (push.state !== "on") push.enable();
  }

  return (
    <div className="min-h-screen bg-canvas">
      {/* Cabeçalho na identidade MarkSeg */}
      <header className="sticky top-0 z-10 border-b border-line bg-surface/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex flex-col items-start">
              <span className="self-end pr-0.5 text-[9px] font-bold uppercase tracking-[0.3em] text-brand-orange">
                Studio
              </span>
              <Image src="/brand/markseg-logo.png" alt="MarkSeg Studio" width={116} height={33} priority />
            </div>
            <span className="hidden h-9 w-px bg-line sm:block" />
            <div className="hidden sm:block">
              <h1 className="font-display text-lg font-bold text-ink">Mural de Recados</h1>
              <p className="text-xs text-muted">Comunicados do time</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2 text-xs font-semibold">
            <a
              href={EXPENSE_URL}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 rounded-lg border border-brand-orange bg-orange-50 px-3 py-1.5 text-xs font-bold text-brand-orange transition-fluid hover:bg-orange-100"
            >
              <Receipt className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Lançar despesa</span>
            </a>
            <PushBell state={push.state} onEnable={push.enable} onDisable={push.disable} />
            <Link
              href="/conversas"
              className="rounded-lg border border-line bg-canvas px-3 py-1.5 text-xs font-semibold text-brand-blue transition-fluid hover:bg-brand-blue-50"
            >
              💬 <span className="hidden sm:inline">Conversas</span>
            </Link>
            {installEvt && (
              <button
                onClick={async () => {
                  installEvt.prompt();
                  await installEvt.userChoice;
                  setInstallEvt(null);
                }}
                className="gradient-brand flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold text-white transition-fluid hover:opacity-95"
              >
                <Download className="h-3.5 w-3.5" /> Instalar app
              </button>
            )}
            {isTeam && (
              <Link
                href="/"
                className="rounded-lg border border-line bg-canvas px-3 py-1.5 text-xs font-semibold text-brand-blue transition-fluid hover:bg-brand-blue-50"
              >
                ← Studio
              </Link>
            )}
          </div>
        </div>
      </header>

      <MuralBanner className="h-24 sm:h-28" />

      <div className="mx-auto max-w-5xl px-4 py-6">
        <h1 className="mb-4 font-display text-2xl font-bold text-ink sm:hidden">Mural de Recados 📌</h1>

        {/* Aviso pra quem não é do time */}
        {!isTeam && (
          <div className="mb-6 flex items-center gap-3 rounded-2xl border border-line bg-brand-blue-50/50 p-4 text-sm text-brand-blue-700">
            <MessageCircle className="h-5 w-5 shrink-0" />
            <span>
              Vá em <Link href="/conversas" className="font-bold underline">Conversas</Link> para sugerir ideias e conversar.
              Use a <b>rede social da MarkSeg</b>. 💬
            </span>
          </div>
        )}

        {/* Compositor — só o time (logado) posta no mural */}
        {isTeam && (
          <div className="card mb-6 p-4">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onFocus={() => (composing.current = true)}
              onBlur={() => (composing.current = false)}
              maxLength={120}
              placeholder="Título do comunicado (ex: Lançamento de despesas)"
              className="mb-2 w-full rounded-lg border border-line bg-canvas px-3 py-2 font-display text-base font-bold text-ink outline-none focus:border-brand-blue focus:bg-white"
            />
            <div className="mb-2 flex flex-wrap items-center gap-3">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                onFocus={() => (composing.current = true)}
                onBlur={() => (composing.current = false)}
                placeholder="Seu nome (opcional)"
                className="w-full rounded-lg border border-line bg-canvas px-3 py-2 text-sm text-ink outline-none focus:border-brand-blue focus:bg-white sm:w-44"
              />
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted">Cor:</span>
                {COLORS.map((c, i) => (
                  <button
                    key={i}
                    onClick={() => setColor(i)}
                    aria-label={`cor ${i + 1}`}
                    className={`h-6 w-6 rounded-full transition ${color === i ? "scale-110 ring-2 ring-ink ring-offset-1" : ""}`}
                    style={{ background: c.edge }}
                  />
                ))}
              </div>
            </div>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              onFocus={() => (composing.current = true)}
              onBlur={() => (composing.current = false)}
              maxLength={8000}
              placeholder="Escreva o comunicado… pode colar links (viram clicáveis)."
              className="h-28 w-full resize-none rounded-xl border border-line bg-canvas p-3 text-sm text-ink outline-none focus:border-brand-blue focus:bg-white"
            />
            {err && <p className="mt-1 text-xs font-medium text-rose-600">{err}</p>}
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <label
                  className={`flex cursor-pointer select-none items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-bold transition ${
                    urgent ? "border-red-500 bg-red-50 text-red-700" : "border-line bg-canvas text-muted hover:text-ink"
                  }`}
                >
                  <input type="checkbox" checked={urgent} onChange={(e) => setUrgent(e.target.checked)} className="accent-red-600" />
                  <AlertTriangle className="h-3.5 w-3.5" /> Urgente (tela cheia + som)
                </label>
                <label
                  className={`flex cursor-pointer select-none items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-bold transition ${
                    pinNew ? "border-brand-blue bg-brand-blue-50 text-brand-blue-700" : "border-line bg-canvas text-muted hover:text-ink"
                  }`}
                >
                  <input type="checkbox" checked={pinNew} onChange={(e) => setPinNew(e.target.checked)} className="accent-brand-blue" />
                  <Pin className="h-3.5 w-3.5" /> Fixar no topo
                </label>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted">{text.length}/8000</span>
                <button
                  onClick={post}
                  disabled={busy || !text.trim()}
                  className="gradient-brand flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white transition-fluid hover:opacity-95 disabled:opacity-50"
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  Publicar comunicado
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Quadro */}
        {items.length === 0 ? (
          <div className="card grid place-items-center gap-2 p-16 text-center text-sm text-muted">
            Nenhum comunicado ainda. 📌
          </div>
        ) : (
          <div className="columns-1 gap-4 sm:columns-2 lg:columns-3 [&>*]:mb-4 [&>*]:break-inside-avoid">
            {items.map((m) => {
              const c = COLORS[m.color] ?? COLORS[0];
              const long = m.message.length > LONG;
              const collapsed = long && !expanded[m.id];
              const mine = myRead(m);
              return (
                <div
                  key={m.id}
                  className={`card group relative overflow-hidden ${m.urgent ? "ring-2 ring-red-500" : ""}`}
                  style={{ borderTop: `4px solid ${m.urgent ? "#dc2626" : c.edge}` }}
                >
                  <div className="p-4">
                    {/* selos */}
                    {(m.urgent || m.pinned) && (
                      <div className="mb-2 flex flex-wrap items-center gap-1.5">
                        {m.urgent && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                            <AlertTriangle className="h-3 w-3" /> Urgente
                          </span>
                        )}
                        {m.pinned && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-brand-blue px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                            <Pin className="h-3 w-3" /> Fixado
                          </span>
                        )}
                      </div>
                    )}

                    {/* título + data do comunicado */}
                    {m.title && <h3 className="font-display text-base font-bold leading-snug text-ink">{m.title}</h3>}
                    <p className="mb-2 mt-0.5 text-[11px] font-semibold uppercase tracking-wide text-muted">
                      📅 {fmtLong(m.created_at)} · {fmtTime(m.created_at)}
                    </p>

                    {/* corpo com "ler mais" */}
                    <p className={`break-words text-sm text-ink ${collapsed ? "line-clamp-6" : "whitespace-pre-wrap"}`}>
                      <Linkified text={m.message} />
                    </p>
                    {long && (
                      <button
                        onClick={() => setExpanded((s) => ({ ...s, [m.id]: !s[m.id] }))}
                        className="mt-1 text-xs font-bold text-brand-blue hover:underline"
                      >
                        {collapsed ? "Ler mais ▾" : "Ler menos ▴"}
                      </button>
                    )}

                    {/* autor + ações do time */}
                    <div className="mt-3 flex items-center justify-between border-t border-line pt-2">
                      <span className="text-[11px] font-semibold text-muted">{m.author || "Direção"}</span>
                      {isTeam && (
                        <span className="flex items-center gap-1 opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100">
                          <button
                            onClick={() => pin(m.id, !m.pinned)}
                            className="grid h-6 w-6 place-items-center rounded text-muted hover:bg-canvas hover:text-ink"
                            title={m.pinned ? "Desafixar" : "Fixar no topo"}
                          >
                            {m.pinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
                          </button>
                          <button
                            onClick={() => del(m.id)}
                            className="grid h-6 w-6 place-items-center rounded text-rose-600 hover:bg-rose-50"
                            title="Apagar"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </span>
                      )}
                    </div>

                    {/* confirmação de leitura */}
                    <div className="mt-3 border-t border-line pt-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        {mine ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600">
                            <CheckCircle2 className="h-4 w-4" /> Você confirmou
                          </span>
                        ) : (
                          <button
                            onClick={() => confirmRead(m)}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-emerald-700"
                          >
                            <Check className="h-3.5 w-3.5" /> Confirmar que li
                          </button>
                        )}
                        {m.reads.length > 0 && (
                          <button
                            onClick={() => setOpenReads((s) => ({ ...s, [m.id]: !s[m.id] }))}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-muted hover:text-ink"
                          >
                            <Eye className="h-3.5 w-3.5" /> {m.reads.length}{" "}
                            {m.reads.length === 1 ? "confirmou" : "confirmaram"} {openReads[m.id] ? "▴" : "▾"}
                          </button>
                        )}
                      </div>
                      {openReads[m.id] && m.reads.length > 0 && (
                        <ul className="mt-2 space-y-1 rounded-lg bg-canvas/60 p-2">
                          {m.reads.map((r) => (
                            <li key={r.reader_id} className="flex items-center justify-between gap-2 text-xs">
                              <span className="min-w-0 truncate font-medium text-ink">
                                ✔️ {r.reader_name || "Alguém"}
                                {r.reader_role && <span className="text-muted"> · {r.reader_role}</span>}
                              </span>
                              <span className="shrink-0 text-muted">{fmt(r.created_at)}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <p className="mt-8 text-center text-xs text-muted">
          Gerado por <b>MarkSeg Studio</b> · studio.markseg.com.br
        </p>
      </div>

      {/* Modal: identificar-se pra confirmar leitura (quem ainda não tem cadastro) */}
      {pendingReadId && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={() => setPendingReadId(null)}>
          <div className="card w-full max-w-sm p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-1 font-display text-lg font-bold text-ink">Quem é você?</h3>
            <p className="mb-3 text-xs text-muted">Pra registrar sua confirmação de leitura. Sem senha.</p>
            <div className="space-y-2">
              <input
                autoFocus
                value={identForm.name}
                onChange={(e) => setIdentForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Seu nome"
                className="w-full rounded-lg border border-line bg-canvas px-3 py-2 text-sm text-ink outline-none focus:border-brand-blue focus:bg-white"
              />
              <input
                value={identForm.role}
                onChange={(e) => setIdentForm((f) => ({ ...f, role: e.target.value }))}
                onKeyDown={(e) => e.key === "Enter" && saveIdentityAndConfirm()}
                placeholder="Seu cargo (ex: Designer)"
                className="w-full rounded-lg border border-line bg-canvas px-3 py-2 text-sm text-ink outline-none focus:border-brand-blue focus:bg-white"
              />
            </div>
            <div className="mt-3 flex justify-end gap-2">
              <button
                onClick={() => setPendingReadId(null)}
                className="rounded-lg px-3 py-2 text-sm font-semibold text-muted hover:text-ink"
              >
                Cancelar
              </button>
              <button
                onClick={saveIdentityAndConfirm}
                disabled={!identForm.name.trim()}
                className="gradient-brand rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                Confirmar leitura
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
