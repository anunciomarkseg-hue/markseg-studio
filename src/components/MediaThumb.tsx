"use client";

import { useState } from "react";
import { Image as ImageIcon, Images, Video, Film, Circle } from "lucide-react";
import type { MediaType } from "@/lib/types";

const ICON: Record<MediaType, React.ElementType> = {
  imagem: ImageIcon,
  carrossel: Images,
  video: Video,
  reel: Film,
  story: Circle,
};

function isVideoUrl(u: string) {
  return /\.(mp4|mov|webm|m4v)(\?|$)/i.test(u);
}

export function MediaThumb({
  media,
  type,
  className = "h-12 w-12 rounded-xl",
}: {
  media: string;
  type: MediaType;
  className?: string;
}) {
  const [broken, setBroken] = useState(false);
  const Icon = ICON[type];

  // mídia real (URL pública do Storage) — se falhar (ex.: apagada após publicar), cai no ícone
  if (media?.startsWith("http") && !broken) {
    if (isVideoUrl(media)) {
      return (
        <video
          src={media}
          onError={() => setBroken(true)}
          className={`${className} object-cover`}
          muted
          playsInline
        />
      );
    }
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={media} alt="" onError={() => setBroken(true)} className={`${className} object-cover`} />;
  }

  // fallback: bloco de degradê com ícone do formato
  const bg = media?.startsWith("http") ? "gradient-brand" : media;
  return (
    <span className={`flex items-center justify-center text-white/90 ${bg} ${className}`}>
      <Icon className="h-1/3 w-1/3" strokeWidth={2.2} />
    </span>
  );
}
