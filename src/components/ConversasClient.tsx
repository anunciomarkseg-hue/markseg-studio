"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Send, Loader2, Trash2, MessageCircle, UserCircle2, Pencil } from "lucide-react";
import type { FeedPost, FeedComment, FeedReaction } from "@/lib/feed";
import { useAutoUpdate } from "@/lib/useAutoUpdate";
import { usePush } from "@/lib/usePush";
import { PushBell } from "@/components/PushBell";
import { ensureAudioUnlock, playChime } from "@/lib/sound";
import { MuralBanner } from "@/components/MuralBanner";

type Me = { name: string; role: string };

const AV = ["#1c6fce", "#f26a2c", "#15a06b", "#e8920c", "#8B5CF6", "#e0483d"];
const avColor = (s: string) => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % AV.length;
  return AV[h];
};
const initials = (s: string) =>
  s.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("") || "?";
const fmt = (iso: string) =>
  new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

const idsOf = (list: FeedPost[]) => {
  const s = new Set<string>();
  for (const p of list) {
    s.add("p:" + p.id);
    for (const c of p.comments) s.add("c:" + c.id);
  }
  return s;
};

function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  return (
    <span
      className="grid shrink-0 place-items-center rounded-full font-bold text-white"
      style={{ background: avColor(name), width: size, height: size, fontSize: size * 0.4 }}
    >
      {initials(name)}
    </span>
  );
}

export function ConversasClient({ initial, isTeam }: { initial: FeedPost[]; isTeam: boolean }) {
  const [posts, setPosts] = useState(initial);
  const [me, setMe] = useState<Me | null>(null);
  const [editingMe, setEditingMe] = useState(false);
  const [nameIn, setNameIn] = useState("");
  const [roleIn, setRoleIn] = useState("");
  const [text, setText] = useState("");
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const composing = useRef(false);
  const cid = useRef<string>("");
  const meRef = useRef<Me | null>(null);
  const seen = useRef<Set<string>>(idsOf(initial));

  useAutoUpdate(composing);
  const push = usePush(() => ({ clientId: cid.current, name: meRef.current?.name ?? null }));

  useEffect(() => {
    meRef.current = me;
  }, [me]);

  // Identidade salva + id anônimo do aparelho (pras reações e avisos)
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
    try {
      const raw = localStorage.getItem("feed_me");
      if (raw) {
        const m = JSON.parse(raw) as Me;
        setMe(m);
        meRef.current = m;
        setNameIn(m.name);
        setRoleIn(m.role);
      } else {
        setEditingMe(true);
      }
    } catch {
      setEditingMe(true);
    }
    refresh(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function refresh(withChime = true) {
    try {
      const q = cid.current ? `?me=${encodeURIComponent(cid.current)}` : "";
      const d = await (await fetch(`/api/feed${q}`, { cache: "no-store" })).json();
      if (!Array.isArray(d.posts)) return;
      const list = d.posts as FeedPost[];
      if (withChime) {
        const mine = meRef.current?.name;
        const hasNew = list.some(
          (p) =>
            (!seen.current.has("p:" + p.id) && p.author_name !== mine) ||
            p.comments.some((c) => !seen.current.has("c:" + c.id) && c.author_name !== mine),
        );
        if (hasNew) playChime("msg");
      }
      seen.current = idsOf(list);
      setPosts(list);
    } catch {
      /* ignora */
    }
  }

  useEffect(() => {
    const t = setInterval(() => {
      if (!composing.current) refresh();
    }, 20000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function saveMe() {
    const name = nameIn.trim();
    if (!name) return;
    const m = { name, role: roleIn.trim() };
    localStorage.setItem("feed_me", JSON.stringify(m));
    setMe(m);
    meRef.current = m;
    setEditingMe(false);
    // já pede permissão de avisos junto do cadastro (pra ninguém esquecer de ligar)
    if (push.state !== "on") push.enable();
  }

  async function publish() {
    const message = text.trim();
    if (!message || !me) return;
    setBusy(true);
    try {
      const r = await fetch("/api/feed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: me.name, role: me.role, message, clientId: cid.current }),
      });
      const d = await r.json();
      if (r.ok) {
        seen.current.add("p:" + d.post.id);
        setPosts((prev) => [d.post, ...prev]);
        setText("");
      }
    } finally {
      setBusy(false);
    }
  }

  async function comment(postId: string) {
    const message = (drafts[postId] ?? "").trim();
    if (!message || !me) return;
    setDrafts((d) => ({ ...d, [postId]: "" }));
    try {
      const r = await fetch(`/api/feed/${postId}/comment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: me.name, role: me.role, message, clientId: cid.current }),
      });
      const d = await r.json();
      if (r.ok) {
        seen.current.add("c:" + d.comment.id);
        setPosts((prev) =>
          prev.map((p) => (p.id === postId ? { ...p, comments: [...p.comments, d.comment as FeedComment] } : p)),
        );
      }
    } catch {
      /* ignora */
    }
  }

  async function react(postId: string, emoji: string) {
    if (!cid.current) return;
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId
          ? {
              ...p,
              reactions: p.reactions.map((r) =>
                r.emoji === emoji ? { ...r, mine: !r.mine, count: r.count + (r.mine ? -1 : 1) } : r,
              ),
            }
          : p,
      ),
    );
    try {
      const r = await fetch(`/api/feed/${postId}/react`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emoji, clientId: cid.current }),
      });
      const d = await r.json();
      if (r.ok && Array.isArray(d.reactions)) {
        setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, reactions: d.reactions as FeedReaction[] } : p)));
      }
    } catch {
      /* ignora */
    }
  }

  async function delPost(id: string) {
    if (!window.confirm("Apagar essa publicação?")) return;
    setPosts((prev) => prev.filter((p) => p.id !== id));
    await fetch(`/api/feed/${id}`, { method: "DELETE" }).catch(() => {});
  }

  return (
    <div className="min-h-screen bg-canvas">
      {/* Cabeçalho */}
      <header className="sticky top-0 z-10 border-b border-line bg-surface/90 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex flex-col items-start">
              <span className="self-end pr-0.5 text-[9px] font-bold uppercase tracking-[0.3em] text-brand-orange">
                Studio
              </span>
              <Image src="/brand/markseg-logo.png" alt="MarkSeg Studio" width={110} height={31} priority />
            </div>
            <span className="hidden h-9 w-px bg-line sm:block" />
            <h1 className="hidden font-display text-lg font-bold text-ink sm:block">Conversas 💬</h1>
          </div>
          <div className="flex items-center gap-2 text-xs font-semibold">
            <PushBell state={push.state} onEnable={push.enable} onDisable={push.disable} />
            <Link href="/mural" className="rounded-lg border border-line bg-canvas px-3 py-1.5 text-brand-blue hover:bg-brand-blue-50">
              📌 Mural
            </Link>
            {isTeam && (
              <Link href="/" className="rounded-lg border border-line bg-canvas px-3 py-1.5 text-brand-blue hover:bg-brand-blue-50">
                ← Studio
              </Link>
            )}
          </div>
        </div>
      </header>

      <MuralBanner className="h-24 sm:h-28" />

      <div className="mx-auto max-w-2xl px-4 py-5">
        {/* Cadastro rápido / identidade */}
        {editingMe || !me ? (
          <div className="card mb-5 p-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-bold text-ink">
              <UserCircle2 className="h-5 w-5 text-brand-blue" /> Cadastro rápido
            </div>
            <p className="mb-3 text-xs text-muted">Só pra sabermos quem é quem nas conversas. Sem senha.</p>
            <div className="flex flex-wrap gap-2">
              <input
                value={nameIn}
                onChange={(e) => setNameIn(e.target.value)}
                placeholder="Seu nome"
                className="min-w-0 flex-1 rounded-lg border border-line bg-canvas px-3 py-2 text-sm text-ink outline-none focus:border-brand-blue focus:bg-white"
              />
              <input
                value={roleIn}
                onChange={(e) => setRoleIn(e.target.value)}
                placeholder="Seu cargo (ex: Designer)"
                className="min-w-0 flex-1 rounded-lg border border-line bg-canvas px-3 py-2 text-sm text-ink outline-none focus:border-brand-blue focus:bg-white"
              />
              <button
                onClick={saveMe}
                disabled={!nameIn.trim()}
                className="gradient-brand rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                Entrar
              </button>
            </div>
          </div>
        ) : (
          <div className="mb-5 flex items-center gap-2.5 rounded-2xl border border-line bg-surface p-2.5">
            <Avatar name={me.name} size={36} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-ink">{me.name}</p>
              {me.role && <p className="truncate text-xs text-muted">{me.role}</p>}
            </div>
            <button
              onClick={() => setEditingMe(true)}
              className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-muted hover:text-ink"
            >
              <Pencil className="h-3.5 w-3.5" /> trocar
            </button>
          </div>
        )}

        {/* Composer */}
        {me && !editingMe && (
          <div className="card mb-6 p-4">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              onFocus={() => (composing.current = true)}
              onBlur={() => (composing.current = false)}
              maxLength={1500}
              placeholder={`No que você tá pensando, ${me.name.split(" ")[0]}?`}
              className="h-24 w-full resize-none rounded-xl border border-line bg-canvas p-3 text-sm text-ink outline-none focus:border-brand-blue focus:bg-white"
            />
            <div className="mt-2 flex items-center justify-between">
              <span className="text-xs text-muted">{text.length}/1500</span>
              <button
                onClick={publish}
                disabled={busy || !text.trim()}
                className="gradient-brand flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white transition-fluid hover:opacity-95 disabled:opacity-50"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Publicar
              </button>
            </div>
          </div>
        )}

        {/* Feed */}
        {posts.length === 0 ? (
          <div className="card grid place-items-center gap-2 p-14 text-center text-sm text-muted">
            <MessageCircle className="h-7 w-7" />
            Nenhuma conversa ainda. Comece a primeira! 💬
          </div>
        ) : (
          <div className="space-y-4">
            {posts.map((p) => (
              <div key={p.id} className="card overflow-hidden">
                <div className="p-4">
                  <div className="flex items-center gap-2.5">
                    <Avatar name={p.author_name} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-ink">{p.author_name}</p>
                      <p className="text-xs text-muted">
                        {p.author_role ? `${p.author_role} · ` : ""}
                        {fmt(p.created_at)}
                      </p>
                    </div>
                    {isTeam && (
                      <button
                        onClick={() => delPost(p.id)}
                        className="grid h-7 w-7 place-items-center rounded text-rose-600 hover:bg-rose-50"
                        title="Apagar (moderação)"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                  <p className="mt-3 whitespace-pre-wrap break-words text-sm text-ink">{p.message}</p>

                  {/* Reações */}
                  <div className="mt-3 flex items-center gap-1.5">
                    {p.reactions.map((r) => (
                      <button
                        key={r.emoji}
                        onClick={() => react(p.id, r.emoji)}
                        className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition ${
                          r.mine
                            ? "border-brand-blue bg-brand-blue-50 font-bold text-brand-blue-700"
                            : "border-line bg-canvas text-muted hover:bg-surface"
                        }`}
                      >
                        <span className="text-sm leading-none">{r.emoji}</span>
                        {r.count > 0 && <span>{r.count}</span>}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Comentários */}
                {p.comments.length > 0 && (
                  <div className="space-y-2.5 border-t border-line bg-canvas/50 px-4 py-3">
                    {p.comments.map((cmt) => (
                      <div key={cmt.id} className="flex items-start gap-2">
                        <Avatar name={cmt.author_name} size={28} />
                        <div className="min-w-0 flex-1 rounded-xl bg-surface px-3 py-2">
                          <p className="text-xs">
                            <span className="font-semibold text-ink">{cmt.author_name}</span>
                            {cmt.author_role && <span className="text-muted"> · {cmt.author_role}</span>}
                          </p>
                          <p className="whitespace-pre-wrap break-words text-sm text-ink">{cmt.message}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Comentar */}
                {me && !editingMe && (
                  <div className="flex items-center gap-2 border-t border-line px-3 py-2">
                    <Avatar name={me.name} size={28} />
                    <input
                      value={drafts[p.id] ?? ""}
                      onChange={(e) => setDrafts((d) => ({ ...d, [p.id]: e.target.value }))}
                      onFocus={() => (composing.current = true)}
                      onBlur={() => (composing.current = false)}
                      onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), comment(p.id))}
                      placeholder="Comentar…"
                      className="min-w-0 flex-1 rounded-full border border-line bg-canvas px-3 py-1.5 text-sm text-ink outline-none focus:border-brand-blue focus:bg-white"
                    />
                    <button
                      onClick={() => comment(p.id)}
                      disabled={!(drafts[p.id] ?? "").trim()}
                      className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-brand-blue disabled:opacity-40"
                    >
                      <Send className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <p className="mt-8 text-center text-xs text-muted">MarkSeg Studio · Conversas do time</p>
      </div>
    </div>
  );
}
