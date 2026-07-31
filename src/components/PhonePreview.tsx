"use client";

import { useEffect, useState } from "react";
import {
  Heart,
  MessageCircle,
  Send,
  Bookmark,
  ThumbsUp,
  MessageSquare,
  Share2,
  MoreHorizontal,
  Globe,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import type { MediaType, Platform, SocialAccount } from "@/lib/types";
import { Avatar } from "./Avatar";

function MediaArea({
  mediaUrls,
  mediaKind,
  type,
}: {
  mediaUrls: string[];
  mediaKind: "image" | "video" | null;
  type: MediaType;
}) {
  const portrait = type === "reel" || type === "story";
  const isVideo = mediaKind === "video" || type === "reel" || type === "video";
  const isCarousel = type === "carrossel" && mediaUrls.length > 1;
  const aspect = portrait ? "aspect-[9/16]" : "aspect-square";

  const [idx, setIdx] = useState(0);
  useEffect(() => {
    setIdx(0);
  }, [mediaUrls.length]);

  if (mediaUrls.length === 0) {
    return (
      <div className={`gradient-brand relative grid w-full ${aspect} place-items-center`}>
        <span className="text-xs font-semibold text-white/85">Prévia da mídia</span>
      </div>
    );
  }

  if (isVideo) {
    return (
      <div className={`relative w-full ${aspect} bg-black`}>
        <video src={mediaUrls[0]} controls playsInline className="h-full w-full object-contain" />
      </div>
    );
  }

  const cur = mediaUrls[Math.min(idx, mediaUrls.length - 1)];
  return (
    <div className={`relative w-full ${aspect} bg-black`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={cur} alt="" className="h-full w-full object-cover" />
      {isCarousel && (
        <>
          <div className="absolute right-3 top-3 rounded-full bg-black/50 px-2 py-0.5 text-[11px] font-semibold text-white">
            {idx + 1}/{mediaUrls.length}
          </div>
          {idx > 0 && (
            <button
              type="button"
              onClick={() => setIdx((i) => Math.max(0, i - 1))}
              className="absolute left-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full bg-white/85 text-ink shadow transition hover:bg-white"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          )}
          {idx < mediaUrls.length - 1 && (
            <button
              type="button"
              onClick={() => setIdx((i) => Math.min(mediaUrls.length - 1, i + 1))}
              className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full bg-white/85 text-ink shadow transition hover:bg-white"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          )}
          <div className="absolute inset-x-0 bottom-2 flex justify-center gap-1">
            {mediaUrls.map((_, i) => (
              <span key={i} className={`h-1.5 w-1.5 rounded-full ${i === idx ? "bg-white" : "bg-white/40"}`} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export function PhonePreview({
  platform,
  account,
  caption,
  mediaType,
  mediaUrls,
  mediaKind,
}: {
  platform: Platform;
  account: SocialAccount;
  caption: string;
  mediaType: MediaType;
  mediaUrls: string[];
  mediaKind: "image" | "video" | null;
}) {
  const text = caption.trim() || "Sua legenda aparece aqui…";
  const media = <MediaArea mediaUrls={mediaUrls} mediaKind={mediaKind} type={mediaType} />;

  if (platform === "instagram") {
    return (
      <div className="w-full max-w-[400px] overflow-hidden rounded-3xl border border-line bg-white shadow-card">
        <div className="flex items-center gap-2 px-3 py-2.5">
          <Avatar account={account} size={30} />
          <span className="text-sm font-semibold text-ink">{account.handle.replace("@", "")}</span>
          <MoreHorizontal className="ml-auto h-4 w-4 text-slate-400" />
        </div>
        {media}
        <div className="flex items-center gap-4 px-3 py-2.5 text-ink">
          <Heart className="h-6 w-6" />
          <MessageCircle className="h-6 w-6" />
          <Send className="h-6 w-6" />
          <Bookmark className="ml-auto h-6 w-6" />
        </div>
        <div className="px-3 pb-3">
          <div className="text-sm font-semibold text-ink">1.248 curtidas</div>
          <p className="mt-1 text-sm leading-snug text-slate-700">
            <span className="font-semibold text-ink">{account.handle.replace("@", "")} </span>
            <span className="whitespace-pre-wrap">{text}</span>
          </p>
          <div className="mt-1.5 text-[11px] uppercase tracking-wide text-slate-400">há instantes</div>
        </div>
      </div>
    );
  }

  if (platform === "linkedin") {
    return (
      <div className="w-full max-w-[420px] overflow-hidden rounded-2xl border border-line bg-white shadow-card">
        <div className="flex items-center gap-2.5 px-3 py-3">
          <Avatar account={account} size={40} />
          <div className="leading-tight">
            <div className="text-sm font-semibold text-ink">{account.name}</div>
            <div className="text-[11px] text-slate-400">Empresa · Agora</div>
          </div>
          <MoreHorizontal className="ml-auto h-5 w-5 text-slate-400" />
        </div>
        <p className="px-3 pb-2.5 text-sm leading-snug text-slate-700 whitespace-pre-wrap">{text}</p>
        {media}
        <div className="grid grid-cols-4 border-t border-line py-1 text-[11px] font-semibold text-slate-500">
          <button className="flex items-center justify-center gap-1 py-2">
            <ThumbsUp className="h-4 w-4" /> Gostei
          </button>
          <button className="flex items-center justify-center gap-1 py-2">
            <MessageSquare className="h-4 w-4" /> Comentar
          </button>
          <button className="flex items-center justify-center gap-1 py-2">
            <Share2 className="h-4 w-4" /> Compart.
          </button>
          <button className="flex items-center justify-center gap-1 py-2">
            <Send className="h-4 w-4" /> Enviar
          </button>
        </div>
      </div>
    );
  }

  // Facebook
  return (
    <div className="w-full max-w-[420px] overflow-hidden rounded-2xl border border-line bg-white shadow-card">
      <div className="flex items-center gap-2.5 px-3 py-3">
        <Avatar account={account} size={40} />
        <div className="leading-tight">
          <div className="text-sm font-semibold text-ink">{account.name}</div>
          <div className="flex items-center gap-1 text-[11px] text-slate-400">
            Agora · <Globe className="h-3 w-3" />
          </div>
        </div>
        <MoreHorizontal className="ml-auto h-5 w-5 text-slate-400" />
      </div>
      <p className="px-3 pb-2.5 text-sm leading-snug text-slate-700 whitespace-pre-wrap">{text}</p>
      {media}
      <div className="grid grid-cols-3 border-t border-line py-1 text-xs font-semibold text-slate-500">
        <button className="flex items-center justify-center gap-1.5 py-2">
          <ThumbsUp className="h-4 w-4" /> Curtir
        </button>
        <button className="flex items-center justify-center gap-1.5 py-2">
          <MessageSquare className="h-4 w-4" /> Comentar
        </button>
        <button className="flex items-center justify-center gap-1.5 py-2">
          <Share2 className="h-4 w-4" /> Compartilhar
        </button>
      </div>
    </div>
  );
}
