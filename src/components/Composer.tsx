"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ImagePlus,
  CalendarClock,
  Save,
  Send,
  CheckCircle2,
  Sparkles,
  Loader2,
  AlertCircle,
  X,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import {
  MEDIA_LABEL,
  type MediaType,
  type Platform,
  type PostStatus,
  type SocialAccount,
} from "@/lib/types";
import { PlatformIcon } from "@/components/PlatformIcon";
import { PhonePreview } from "@/components/PhonePreview";
import { AccountMultiSelect } from "@/components/AccountMultiSelect";
import { ReelCoverPicker } from "@/components/ReelCoverPicker";
import { accountIdsForGroup, buildClients, groupKeyOf } from "@/lib/clients";
import { uploadMediaDirect } from "@/lib/supabase-browser";
import { suggestCaption } from "@/lib/caption";

const MEDIA_TYPES: MediaType[] = ["imagem", "carrossel", "video", "reel", "story"];
const FALLBACK_MEDIA = "gradient-brand";

const PLATFORM_LABEL: Record<Platform, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  linkedin: "LinkedIn",
  tiktok: "TikTok",
};

type ApiResult = {
  error?: string;
  id?: string;
  ok?: boolean;
  published?: number;
  failed?: number;
  processing?: number;
  skipped?: boolean;
  message?: string;
  details?: { error?: string }[];
};

/** Lê a resposta com segurança. Se o servidor devolver um erro que NÃO é JSON
 *  (timeout/crash de plataforma — ex.: função cortada por tempo no vídeo/Reel),
 *  vira uma mensagem legível em vez de quebrar a tela com "... is not valid JSON". */
async function parseResponse(res: Response): Promise<ApiResult> {
  const text = await res.text();
  try {
    return text ? (JSON.parse(text) as ApiResult) : {};
  } catch {
    const timeout = /timeout|timed out|invocation_timeout|an error occ|gateway|504/i.test(text);
    return {
      error: timeout
        ? "A publicação demorou demais e o servidor cortou (comum em Reel/vídeo). Ele pode ainda estar processando — espere alguns segundos e clique em Publicar de novo."
        : `O servidor respondeu de forma inesperada (código ${res.status}). Tente de novo em instantes.`,
    };
  }
}

function defaultDate() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

export function Composer({
  accounts,
  activeGroup,
}: {
  accounts: SocialAccount[];
  activeGroup: string | null;
}) {
  const router = useRouter();

  const [selected, setSelected] = useState<string[]>(accountIdsForGroup(accounts, activeGroup));
  const [caption, setCaption] = useState("");
  const [baseSeed, setBaseSeed] = useState(""); // tema original digitado (base das variações)
  const [suggestN, setSuggestN] = useState(0);
  const [collab, setCollab] = useState("");
  const [shareToFeed, setShareToFeed] = useState(false);
  const [mediaType, setMediaType] = useState<MediaType>("imagem");
  const [date, setDate] = useState(defaultDate());
  const [time, setTime] = useState("10:00");
  const [saving, setSaving] = useState<null | PostStatus>(null);
  const [done, setDone] = useState<null | { label: string; status: PostStatus }>(null);
  const [error, setError] = useState<string | null>(null);

  // upload de mídia (carrossel = várias imagens; resto = 1)
  const [mediaUrls, setMediaUrls] = useState<string[]>([]);
  const [mediaKind, setMediaKind] = useState<"image" | "video" | null>(null);
  // arquivo local do vídeo — usado pra escolher um frame como capa sem CORS
  const [videoFile, setVideoFile] = useState<File | null>(null);
  // arrastar-e-soltar do carrossel
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [compressPct, setCompressPct] = useState<number | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [publishing, setPublishing] = useState(false);

  // capa do Reel (opcional)
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [uploadingCover, setUploadingCover] = useState(false);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const isVideoFormat = mediaType === "reel" || mediaType === "video";
  const isCarousel = mediaType === "carrossel";

  const mediaUrl = mediaUrls[0] ?? null;

  function changeFormat(t: MediaType) {
    setMediaType(t);
    setMediaUrls([]);
    setMediaKind(null);
    setVideoFile(null);
    setDone(null);
  }

  function suggest() {
    // gera sempre a partir do TEMA original (não da legenda já gerada)
    setCaption(
      suggestCaption({
        seed: baseSeed,
        platform: activePlatform,
        client: previewAccount?.name ?? selectedAccounts[0]?.name,
        variant: suggestN,
      }),
    );
    setSuggestN((n) => n + 1);
    setDone(null);
  }

  const selectedAccounts = accounts.filter((a) => selected.includes(a.id));
  const platforms = useMemo(
    () => [...new Set(selectedAccounts.map((a) => a.platform))] as Platform[],
    [selectedAccounts],
  );
  const [previewTab, setPreviewTab] = useState<Platform>("instagram");
  const activePlatform: Platform = platforms.includes(previewTab)
    ? previewTab
    : platforms[0] ?? "instagram";
  const previewAccount = selectedAccounts.find((a) => a.platform === activePlatform);

  // Quais "clientes" as contas selecionadas representam (pra mostrar o destino e
  // avisar se você misturou contas de clientes diferentes num post só).
  const selKeys = new Set(selectedAccounts.map(groupKeyOf));
  const selectedClients = selectedAccounts.length
    ? buildClients(accounts).filter((c) => selKeys.has(c.key))
    : [];
  const multiClient = selectedClients.length > 1;
  // contas selecionadas com token expirado (precisam reconectar antes de postar)
  const reconnectAccounts = selectedAccounts.filter((a) => a.needs_reconnect);

  // Mantém "Publicar em" em SINCRONIA com o seletor de cliente do topo. Sem isto,
  // trocar o cliente lá em cima NÃO mexia nas contas daqui — e dava pra publicar
  // no cliente errado (você via um nome no topo e outro no destino do post).
  const prevGroup = useRef(activeGroup);
  useEffect(() => {
    if (prevGroup.current === activeGroup) return; // ignora o 1º render (mount)
    prevGroup.current = activeGroup;
    setSelected(accountIdsForGroup(accounts, activeGroup));
    setDone(null);
    setError(null);
  }, [activeGroup, accounts]);

  // vindo da Pauta ("Agendar") — preenche o composer e, ao publicar, marca a pauta como agendada
  const [editorialId, setEditorialId] = useState<string | null>(null);
  useEffect(() => {
    const raw = typeof window !== "undefined" ? sessionStorage.getItem("pauta_prefill") : null;
    if (!raw) return;
    sessionStorage.removeItem("pauta_prefill");
    try {
      const pf = JSON.parse(raw) as {
        editorialId?: string;
        group?: string;
        caption?: string;
        format?: string;
        networks?: string[];
        date?: string;
      };
      if (pf.caption) {
        setCaption(pf.caption);
        setBaseSeed(pf.caption);
      }
      const fmtMap: Record<string, MediaType> = {
        feed: "imagem",
        carrossel: "carrossel",
        reel: "reel",
        story: "story",
      };
      if (pf.format && fmtMap[pf.format]) setMediaType(fmtMap[pf.format]);
      if (pf.date) {
        const d = new Date(pf.date);
        setDate(d.toISOString().slice(0, 10));
        setTime(d.toTimeString().slice(0, 5));
      }
      if (pf.group) {
        let ids = accountIdsForGroup(accounts, pf.group);
        if (pf.networks?.length) {
          const nets = new Set(pf.networks);
          ids = ids.filter((id) => {
            const a = accounts.find((x) => x.id === id);
            return a && nets.has(a.platform);
          });
        }
        if (ids.length) setSelected(ids);
      }
      if (pf.editorialId) setEditorialId(pf.editorialId);
    } catch {
      /* ignora prefill inválido */
    }
  }, [accounts]);

  function markPautaScheduled(scheduledId: string) {
    if (!editorialId) return;
    fetch(`/api/editorial/${editorialId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scheduled_post_id: scheduledId }),
    }).catch(() => {});
  }

  const igSelected = platforms.includes("instagram");
  const collaborators = collab
    .split(/[\s,]+/)
    .map((s) => s.replace(/^@/, "").trim())
    .filter(Boolean)
    .slice(0, 3);

  function onSelectChange(ids: string[]) {
    setDone(null);
    setError(null);
    setSelected(ids);
  }

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError(null);
    setUploading(true);
    setDone(null);
    try {
      const onStage = (s: { stage: "compress" | "upload"; pct?: number }) =>
        setCompressPct(s.stage === "compress" ? (s.pct ?? 0) : null);
      if (isCarousel) {
        const imgs = Array.from(e.target.files ?? []).filter((f) => !f.type.startsWith("video"));
        const urls: string[] = [];
        for (const f of imgs) {
          const data = await uploadMediaDirect(f, onStage);
          urls.push(data.url);
        }
        setMediaUrls((prev) => [...prev, ...urls].slice(0, 10));
        setMediaKind("image");
      } else {
        const data = await uploadMediaDirect(file, onStage);
        setMediaUrls([data.url]);
        setMediaKind(data.isVideo ? "video" : "image");
        // guarda o arquivo local do vídeo pra poder escolher um frame como capa
        setVideoFile(data.isVideo ? file : null);
      }
    } catch (err) {
      setUploadError((err as Error).message);
    } finally {
      setUploading(false);
      setCompressPct(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function removeMedia(idx?: number) {
    if (typeof idx === "number") {
      setMediaUrls((prev) => prev.filter((_, i) => i !== idx));
    } else {
      setMediaUrls([]);
      setMediaKind(null);
      setVideoFile(null);
    }
  }

  /** Sobe um frame capturado do vídeo como capa do Reel. */
  async function usarFrameComoCapa(frame: File) {
    setUploadError(null);
    setUploadingCover(true);
    try {
      const data = await uploadMediaDirect(frame);
      setCoverUrl(data.url);
    } catch (err) {
      setUploadError((err as Error).message);
    } finally {
      setUploadingCover(false);
    }
  }

  /** Reordena as imagens do carrossel (a ordem daqui é a ordem no feed). */
  function moveMedia(idx: number, dir: -1 | 1) {
    setMediaUrls((prev) => {
      const j = idx + dir;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[j]] = [next[j], next[idx]];
      return next;
    });
  }

  /** Move um card de uma posição pra outra (arrastar e soltar). */
  function reorderMedia(from: number, to: number) {
    setMediaUrls((prev) => {
      if (from === to || from < 0 || to < 0 || from >= prev.length || to >= prev.length) return prev;
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  }

  function onCardDrop(target: number) {
    if (dragIndex !== null) reorderMedia(dragIndex, target);
    setDragIndex(null);
    setOverIndex(null);
  }

  async function onCoverChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError(null);
    setUploadingCover(true);
    try {
      const data = await uploadMediaDirect(file);
      setCoverUrl(data.url);
    } catch (err) {
      setUploadError((err as Error).message);
    } finally {
      setUploadingCover(false);
      if (coverInputRef.current) coverInputRef.current.value = "";
    }
  }

  /** Limpa a tela depois de agendar/publicar — a mídia NÃO pode ficar carregada
   *  (foi isso que deixou reenviar e duplicou o post do cliente). */
  function resetComposer() {
    setCaption("");
    setBaseSeed("");
    setSuggestN(0);
    setCollab("");
    setShareToFeed(false);
    setMediaUrls([]);
    setMediaKind(null);
    setVideoFile(null);
    setCoverUrl(null);
    setEditorialId(null);
    setUploadError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (coverInputRef.current) coverInputRef.current.value = "";
  }

  /** Mostra o destino EXATO (cliente + @contas) antes de agendar/publicar. É a
   *  trava contra postar no cliente errado. */
  function confirmDestination(action: string, live: boolean): boolean {
    const lines = selectedAccounts
      .map((a) => `• ${a.handle} — ${PLATFORM_LABEL[a.platform]}`)
      .join("\n");
    const clientsTxt = selectedClients.map((c) => c.name).join(", ");
    const head = multiClient
      ? `⚠️ ATENÇÃO: são contas de ${selectedClients.length} CLIENTES diferentes (${clientsTxt}).`
      : `Cliente: ${clientsTxt || "—"}`;
    const liveWarn = live ? "\n\nIsso posta AO VIVO agora — fica visível pros seguidores." : "";
    return window.confirm(
      `${action}?\n\n${head}\n\nVai para ${selectedAccounts.length} conta(s):\n${lines}${liveWarn}\n\nConfirmar destino?`,
    );
  }

  async function submit(status: PostStatus) {
    setError(null);
    setDone(null);
    if (selected.length === 0) {
      setError("Selecione pelo menos uma conta.");
      return;
    }
    if (status === "agendado" && !confirmDestination("AGENDAR", false)) return;
    setSaving(status);
    try {
      const scheduledFor = new Date(`${date}T${time}`).toISOString();
      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          caption,
          mediaType,
          media: mediaUrls.length ? mediaUrls : [FALLBACK_MEDIA],
          cover_url: coverUrl,
          scheduledFor,
          status,
          accountIds: selected,
          collaborators,
          shareToFeed,
        }),
      });
      const data = await parseResponse(res);
      if (!res.ok) throw new Error(data.error ?? `Erro ao salvar (código ${res.status})`);
      markPautaScheduled(data.id ?? "");

      const label = new Date(`${date}T${time}`).toLocaleDateString("pt-BR", {
        weekday: "long",
        day: "2-digit",
        month: "long",
      });
      setDone({ label: `${label} às ${time}`, status });
      resetComposer();
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(null);
    }
  }

  async function publishNow() {
    setError(null);
    setDone(null);
    if (selected.length === 0) {
      setError("Selecione pelo menos uma conta.");
      return;
    }
    if (!confirmDestination("PUBLICAR AGORA", true)) return;
    setPublishing(true);
    try {
      // "Publicar agora" = a data do post é AGORA (não a do seletor), pra cair
      // no dia de hoje no Calendário/histórico.
      const scheduledFor = new Date().toISOString();
      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          caption,
          mediaType,
          media: mediaUrls.length ? mediaUrls : [FALLBACK_MEDIA],
          cover_url: coverUrl,
          scheduledFor,
          status: "agendado",
          accountIds: selected,
          collaborators,
          shareToFeed,
        }),
      });
      const data = await parseResponse(res);
      if (!res.ok) throw new Error(data.error ?? `Erro ao criar o post (código ${res.status})`);
      markPautaScheduled(data.id ?? "");

      const pubRes = await fetch(`/api/posts/${data.id}/publish`, { method: "POST" });
      const pub = await parseResponse(pubRes);
      if (!pubRes.ok) throw new Error(pub.error ?? "Erro ao publicar");

      if ((pub.published ?? 0) > 0) {
        setDone({
          status: "publicado",
          label: `${pub.published} conta(s)${pub.failed ? ` · ${pub.failed} falhou(aram)` : ""}`,
        });
        resetComposer();
      } else {
        const firstErr = pub.details?.find((d) => d.error)?.error ?? "falhou";
        setError(`Não publicou: ${firstErr}`);
      }
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPublishing(false);
    }
  }

  const canPublish = selected.length > 0 && accounts.length > 0;
  const busy = saving !== null || publishing;

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6 animate-rise">
        <h1 className="font-display text-2xl font-bold text-ink">Nova publicação</h1>
        <p className="mt-1 text-sm text-muted">
          Escolha a conta, envie a mídia, escreva e agende. Foque em uma conta por vez pra não errar o destino.
        </p>
      </div>

      {done && (
        <div className="mb-6 flex flex-wrap items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-800 animate-rise">
          <CheckCircle2 className="h-5 w-5 shrink-0" />
          <p className="text-sm font-medium">
            {done.status === "rascunho" ? (
              <>Rascunho salvo no banco. ✅</>
            ) : done.status === "publicado" ? (
              <>
                Publicado ao vivo em <span className="font-bold">{done.label}</span>! 🎉
              </>
            ) : (
              <>
                Publicação <b>agendada</b> e salva para{" "}
                <span className="font-bold capitalize">{done.label}</span>. ✅
              </>
            )}{" "}
            <Link href="/publicacoes" className="font-bold underline">
              Ver em Publicações →
            </Link>
          </p>
        </div>
      )}

      {error && (
        <div className="mb-6 flex items-center gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-700 animate-rise">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <p className="text-sm font-medium">{error}</p>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-5">
        {/* ----------- Editor ----------- */}
        <div className="space-y-5 lg:col-span-3">
          {/* Contas */}
          <section className="card p-5">
            <label className="mb-3 block text-sm font-semibold text-ink">Publicar em</label>
            {accounts.length === 0 ? (
              <p className="text-sm text-muted">
                Nenhuma conta conectada ainda.{" "}
                <Link href="/contas" className="font-semibold text-brand-blue">
                  Conectar contas →
                </Link>
              </p>
            ) : (
              <>
                <AccountMultiSelect accounts={accounts} selected={selected} onChange={onSelectChange} />
                {selectedAccounts.length > 0 &&
                  (multiClient ? (
                    <div className="mt-3 flex items-start gap-2 rounded-xl border border-rose-300 bg-rose-50 p-3 text-rose-700">
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                      <p className="text-xs font-medium">
                        Você selecionou contas de{" "}
                        <b>{selectedClients.length} clientes diferentes</b>:{" "}
                        {selectedClients.map((c) => c.name).join(", ")}. Confira se é isso mesmo
                        antes de publicar.
                      </p>
                    </div>
                  ) : (
                    <p className="mt-3 text-xs text-muted">
                      Destino:{" "}
                      <b className="text-ink">{selectedClients[0]?.name ?? "—"}</b> ·{" "}
                      {selectedAccounts.length} conta(s)
                    </p>
                  ))}

                {reconnectAccounts.length > 0 && (
                  <div className="mt-3 flex items-start gap-2 rounded-xl border border-rose-300 bg-rose-50 p-3 text-rose-700">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <p className="text-xs font-medium">
                      Token expirado em: {reconnectAccounts.map((a) => a.handle).join(", ")}. Essas
                      contas <b>não vão publicar</b> até serem reconectadas.{" "}
                      <Link href="/contas" className="font-bold underline">
                        Reconectar agora →
                      </Link>
                    </p>
                  </div>
                )}
              </>
            )}
          </section>

          {/* Legenda */}
          <section className="card p-5">
            <div className="mb-3 flex items-center justify-between">
              <label className="text-sm font-semibold text-ink">Legenda</label>
              <span className="text-xs text-muted">{caption.length}/2200</span>
            </div>
            <textarea
              value={caption}
              maxLength={2200}
              onChange={(e) => {
                setCaption(e.target.value);
                setBaseSeed(e.target.value); // o que você digita vira a base das sugestões
                setSuggestN(0);
                setDone(null);
              }}
              placeholder="Escreva o tema/ideia e clique em Sugerir legenda ✨"
              className="h-36 w-full resize-none rounded-xl border border-line bg-canvas p-3 text-sm text-ink outline-none transition-fluid placeholder:text-slate-400 focus:border-brand-blue focus:bg-white"
            />
            <button
              type="button"
              onClick={suggest}
              className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-brand-orange-50 px-2.5 py-1.5 text-xs font-semibold text-brand-orange transition-fluid hover:brightness-95"
            >
              <Sparkles className="h-3.5 w-3.5" /> Sugerir legenda {suggestN > 0 && "(outra)"}
            </button>
          </section>

          {/* Colaboradores (Collab do Instagram) */}
          {igSelected && mediaType !== "story" && (
            <section className="card p-5">
              <div className="mb-1 flex items-center justify-between">
                <label className="flex items-center gap-1.5 text-sm font-semibold text-ink">
                  <PlatformIcon platform="instagram" className="h-4 w-4 text-brand-orange" />
                  Colaboradores (Collab)
                </label>
                <span className="text-xs text-muted">{collaborators.length}/3</span>
              </div>
              <p className="mb-3 text-xs text-muted">
                Convida até 3 perfis como coautores — o post aparece no perfil deles também. Eles
                recebem uma notificação pra aceitar. As contas precisam ser <b>públicas</b>.
              </p>
              <input
                value={collab}
                onChange={(e) => {
                  setCollab(e.target.value);
                  setDone(null);
                }}
                placeholder="@perfil1, @perfil2, @perfil3"
                className="w-full rounded-xl border border-line bg-canvas p-3 text-sm text-ink outline-none transition-fluid placeholder:text-slate-400 focus:border-brand-blue focus:bg-white"
              />
              {collaborators.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {collaborators.map((c) => (
                    <span
                      key={c}
                      className="rounded-full bg-brand-blue-50 px-2.5 py-1 text-xs font-semibold text-brand-blue"
                    >
                      @{c}
                    </span>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* Formato + mídia */}
          <section className="card p-5">
            <label className="mb-3 block text-sm font-semibold text-ink">Formato</label>
            <div className="mb-4 flex flex-wrap gap-2">
              {MEDIA_TYPES.map((t) => (
                <button
                  key={t}
                  onClick={() => changeFormat(t)}
                  className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition-fluid ${
                    mediaType === t
                      ? "gradient-brand text-white"
                      : "bg-canvas text-muted hover:text-ink"
                  }`}
                >
                  {MEDIA_LABEL[t]}
                </button>
              ))}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept={isCarousel ? "image/*" : "image/*,video/*"}
              multiple={isCarousel}
              className="hidden"
              onChange={onFileChange}
            />

            {isCarousel ? (
              /* ===== CARROSSEL: grade de imagens (2 a 10) ===== */
              <div>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {mediaUrls.map((url, i) => (
                    <div
                      key={url}
                      draggable
                      onDragStart={() => setDragIndex(i)}
                      onDragOver={(e) => {
                        e.preventDefault();
                        if (overIndex !== i) setOverIndex(i);
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        onCardDrop(i);
                      }}
                      onDragEnd={() => {
                        setDragIndex(null);
                        setOverIndex(null);
                      }}
                      className={`group relative aspect-square cursor-grab rounded-lg transition-fluid active:cursor-grabbing ${
                        dragIndex === i ? "opacity-40" : ""
                      } ${
                        overIndex === i && dragIndex !== null && dragIndex !== i
                          ? "ring-2 ring-brand-blue ring-offset-2 ring-offset-canvas"
                          : ""
                      }`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={url}
                        alt={`imagem ${i + 1}`}
                        draggable={false}
                        className="pointer-events-none h-full w-full rounded-lg object-cover"
                      />
                      {/* número da ORDEM — é a ordem que sai no feed */}
                      <span className="absolute left-1 top-1 grid h-6 w-6 place-items-center rounded-md bg-brand-blue text-xs font-bold text-white shadow">
                        {i + 1}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeMedia(i)}
                        className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-md bg-rose-600 text-white opacity-100 transition-fluid sm:opacity-0 sm:group-hover:opacity-100"
                        title="Remover"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                      {/* reordenar — define a ordem no feed */}
                      <div className="absolute inset-x-1 bottom-1 flex justify-between opacity-100 transition-fluid sm:opacity-0 sm:group-hover:opacity-100">
                        <button
                          type="button"
                          disabled={i === 0}
                          onClick={() => moveMedia(i, -1)}
                          className="grid h-6 w-6 place-items-center rounded-md bg-ink/75 text-white transition-fluid hover:bg-ink disabled:opacity-30"
                          title="Mover pra esquerda"
                        >
                          <ChevronLeft className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={i === mediaUrls.length - 1}
                          onClick={() => moveMedia(i, 1)}
                          className="grid h-6 w-6 place-items-center rounded-md bg-ink/75 text-white transition-fluid hover:bg-ink disabled:opacity-30"
                          title="Mover pra direita"
                        >
                          <ChevronRight className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                  {mediaUrls.length < 10 && (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                      className="grid aspect-square place-items-center rounded-lg border border-dashed border-slate-300 bg-canvas text-muted transition-fluid hover:border-brand-blue disabled:opacity-60"
                    >
                      {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImagePlus className="h-5 w-5" />}
                    </button>
                  )}
                </div>
                <p className="mt-2 text-xs text-muted">
                  {mediaUrls.length === 0
                    ? "Adicione de 2 a 10 imagens pro carrossel."
                    : `${mediaUrls.length}/10 · o número é a ORDEM no feed — arraste os cards pra reordenar (ou use ◀ ▶ no celular).`}
                </p>
              </div>
            ) : mediaUrl ? (
              <div className="flex items-center gap-4 rounded-xl border border-line bg-canvas p-4">
                {mediaKind === "video" ? (
                  <video src={mediaUrl} className="h-20 w-20 rounded-xl object-cover" muted playsInline />
                ) : (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={mediaUrl} alt="mídia enviada" className="h-20 w-20 rounded-xl object-cover" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-ink">Mídia enviada ✓</p>
                  <p className="text-xs text-muted">Pronta pra publicar.</p>
                </div>
                <button
                  onClick={() => removeMedia()}
                  className="flex items-center gap-1 rounded-lg border border-line px-2.5 py-1.5 text-xs font-semibold text-rose-600 transition-fluid hover:bg-rose-50"
                >
                  <X className="h-3.5 w-3.5" /> Remover
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="flex w-full items-center gap-4 rounded-xl border border-dashed border-slate-300 bg-canvas p-4 text-left transition-fluid hover:border-brand-blue disabled:opacity-60"
              >
                <div className="gradient-brand grid h-16 w-16 shrink-0 place-items-center rounded-xl text-white">
                  {uploading ? <Loader2 className="h-6 w-6 animate-spin" /> : <ImagePlus className="h-6 w-6" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-ink">
                    {compressPct !== null
                      ? `Comprimindo vídeo… ${compressPct}%`
                      : uploading
                        ? "Enviando…"
                        : "Clique para enviar a mídia"}
                  </p>
                  <p className="text-xs text-muted">
                    {compressPct !== null
                      ? "Otimizando pro padrão do Instagram (pode levar 1-2 min)"
                      : "JPG, PNG ou MP4 · vídeo grande é comprimido automático"}
                  </p>
                </div>
              </button>
            )}
            {uploadError && <p className="mt-2 text-xs font-medium text-rose-600">{uploadError}</p>}

            {isVideoFormat && (
              <div className="mt-4 border-t border-line pt-4">
                <label className="mb-2 block text-xs font-semibold text-ink">Capa do Reel (opcional)</label>
                <input
                  ref={coverInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={onCoverChange}
                />

                {/* Escolher um frame do próprio vídeo como capa (igual ao app) */}
                {mediaKind === "video" && (
                  <ReelCoverPicker
                    file={videoFile}
                    url={mediaUrl}
                    busy={uploadingCover}
                    onPick={usarFrameComoCapa}
                  />
                )}

                {coverUrl && (
                  <div className="mt-3 flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={coverUrl} alt="capa do reel" className="h-16 w-16 rounded-lg object-cover" />
                    <span className="flex-1 text-xs font-medium text-emerald-800">Capa definida ✓</span>
                    <button
                      onClick={() => setCoverUrl(null)}
                      className="text-xs font-semibold text-rose-600 transition-fluid hover:underline"
                    >
                      Remover
                    </button>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => coverInputRef.current?.click()}
                  disabled={uploadingCover}
                  className="mt-3 flex w-full items-center gap-3 rounded-xl border border-dashed border-slate-300 bg-canvas p-3 text-left text-sm text-muted transition-fluid hover:border-brand-blue disabled:opacity-60"
                >
                  {uploadingCover ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <ImagePlus className="h-5 w-5" />
                  )}
                  {uploadingCover
                    ? "Enviando capa…"
                    : mediaKind === "video"
                      ? "Ou enviar uma imagem de capa"
                      : "Enviar imagem de capa (thumbnail)"}
                </button>

                {igSelected && (
                  <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border border-line bg-canvas p-3">
                    <input
                      type="checkbox"
                      checked={shareToFeed}
                      onChange={(e) => setShareToFeed(e.target.checked)}
                      className="mt-0.5 h-4 w-4 accent-[#1c6fce]"
                    />
                    <span>
                      <span className="block text-sm font-semibold text-ink">
                        Mostrar o Reel também no feed
                      </span>
                      <span className="block text-xs text-muted">
                        Desmarcado (padrão), o Reel fica <b>só na aba Reels</b> — não aparece na
                        grade/feed do perfil.
                      </span>
                    </span>
                  </label>
                )}
              </div>
            )}
          </section>

          {/* Agendamento */}
          <section className="card p-5">
            <label className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink">
              <CalendarClock className="h-4 w-4 text-brand-blue" /> Quando publicar
            </label>
            <div className="flex flex-wrap gap-3">
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="rounded-xl border border-line bg-canvas px-3 py-2.5 text-sm text-ink outline-none focus:border-brand-blue focus:bg-white"
              />
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="rounded-xl border border-line bg-canvas px-3 py-2.5 text-sm text-ink outline-none focus:border-brand-blue focus:bg-white"
              />
            </div>
            <p className="mt-2 text-xs text-muted">
              ✅ Pode agendar pra <b>qualquer data</b> — sem o limite de 29 dias da Meta (a gente publica pelo nosso próprio agendador).
            </p>
          </section>

          {/* Ações */}
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => submit("rascunho")}
              disabled={busy}
              className="flex items-center gap-2 rounded-xl border border-line bg-surface px-4 py-2.5 text-sm font-semibold text-ink transition-fluid hover:bg-canvas disabled:opacity-50"
            >
              {saving === "rascunho" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Salvar rascunho
            </button>
            <button
              onClick={() => submit("agendado")}
              disabled={!canPublish || busy}
              className="flex items-center gap-2 rounded-xl border-2 border-brand-blue px-5 py-2.5 text-sm font-semibold text-brand-blue-700 transition-fluid hover:bg-brand-blue-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {saving === "agendado" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CalendarClock className="h-4 w-4" />
              )}
              Agendar
            </button>
            <button
              onClick={publishNow}
              disabled={!canPublish || busy}
              className="gradient-brand flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white shadow-card transition-fluid hover:opacity-95 hover:shadow-pop disabled:cursor-not-allowed disabled:opacity-40"
            >
              {publishing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Publicar agora
            </button>
          </div>
        </div>

        {/* ----------- Preview ----------- */}
        <div className="lg:col-span-2">
          <div className="sticky top-24">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm font-semibold text-muted">Pré-visualização</span>
              {platforms.length > 0 && (
                <div className="flex gap-1 rounded-lg bg-canvas p-1">
                  {platforms.map((p) => (
                    <button
                      key={p}
                      onClick={() => setPreviewTab(p)}
                      className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold capitalize transition-fluid ${
                        activePlatform === p ? "bg-white text-ink shadow-sm" : "text-muted"
                      }`}
                    >
                      <PlatformIcon platform={p} className="h-3.5 w-3.5" />
                      {p === "instagram" ? "Instagram" : p === "linkedin" ? "LinkedIn" : "Facebook"}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-center rounded-3xl bg-canvas p-5">
              {previewAccount ? (
                <PhonePreview
                  platform={activePlatform}
                  account={previewAccount}
                  caption={caption}
                  mediaType={mediaType}
                  mediaUrls={mediaUrls}
                  mediaKind={mediaKind}
                />
              ) : (
                <p className="py-16 text-center text-sm text-muted">
                  Selecione uma conta para ver a prévia.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
