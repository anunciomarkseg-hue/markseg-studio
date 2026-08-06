"use client";

import { useEffect, useRef, useState } from "react";
import { ImagePlus, Loader2 } from "lucide-react";

function fmt(t: number) {
  if (!Number.isFinite(t) || t < 0) return "0:00";
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * Escolhe um FRAME do próprio vídeo como capa do Reel — igual ao app do
 * Instagram. Arrasta a linha do tempo, vê o quadro e "congela" ele como imagem.
 *
 * Captura sempre do ARQUIVO local (blob:) quando disponível, pra o canvas nunca
 * esbarrar em restrição de origem (CORS) do storage. Sem o arquivo (ex.: veio da
 * Pauta), cai pra URL pública com crossOrigin.
 */
export function ReelCoverPicker({
  file,
  url,
  busy = false,
  onPick,
}: {
  file: File | null;
  url: string | null;
  busy?: boolean;
  onPick: (frame: File) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [src, setSrc] = useState<string | null>(null);
  const [fromFile, setFromFile] = useState(false);
  const [duration, setDuration] = useState(0);
  const [time, setTime] = useState(0);
  const [ready, setReady] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setReady(false);
    setErr(null);
    setTime(0);
    if (file) {
      const obj = URL.createObjectURL(file);
      setSrc(obj);
      setFromFile(true);
      return () => URL.revokeObjectURL(obj);
    }
    setSrc(url);
    setFromFile(false);
  }, [file, url]);

  function seek(t: number) {
    setTime(t);
    const v = videoRef.current;
    if (v) v.currentTime = Math.min(t, Math.max(0, (v.duration || 0) - 0.05));
  }

  function capture() {
    const v = videoRef.current;
    if (!v || !v.videoWidth) {
      setErr("O vídeo ainda não carregou — espere um instante e tente de novo.");
      return;
    }
    try {
      const canvas = document.createElement("canvas");
      canvas.width = v.videoWidth;
      canvas.height = v.videoHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) => {
          if (blob) onPick(new File([blob], "capa-reel.jpg", { type: "image/jpeg" }));
          else setErr("Não consegui capturar esse frame. Tente outro ponto do vídeo.");
        },
        "image/jpeg",
        0.92,
      );
    } catch {
      setErr(
        fromFile
          ? "Não consegui capturar esse frame."
          : "Esse vídeo não permite captura por aqui. Reenvie o vídeo pra escolher o frame.",
      );
    }
  }

  if (!src) return null;

  return (
    <div className="rounded-xl border border-line bg-canvas p-3">
      <p className="mb-2 text-xs font-semibold text-ink">
        Escolher um frame do vídeo pra capa 🎬
      </p>
      <div className="grid place-items-center overflow-hidden rounded-lg bg-black">
        <video
          ref={videoRef}
          src={src}
          muted
          playsInline
          preload="metadata"
          crossOrigin={fromFile ? undefined : "anonymous"}
          onLoadedMetadata={(e) => {
            setDuration(e.currentTarget.duration || 0);
            // força o navegador a desenhar o 1º frame (senão fica preto)
            e.currentTarget.currentTime = 0.05;
            setReady(true);
          }}
          onError={() => setErr("Não consegui carregar o vídeo pra escolher o frame.")}
          className="max-h-64 w-auto"
        />
      </div>

      <input
        type="range"
        min={0}
        max={Math.max(duration, 0.1)}
        step={0.05}
        value={time}
        disabled={!ready}
        onChange={(e) => seek(parseFloat(e.target.value))}
        className="mt-3 w-full accent-[#1c6fce] disabled:opacity-50"
        aria-label="Posição do vídeo"
      />
      <div className="mt-1 flex items-center justify-between gap-2">
        <span className="text-xs tabular-nums text-muted">
          {fmt(time)} / {fmt(duration)}
        </span>
        <button
          type="button"
          onClick={capture}
          disabled={!ready || busy}
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand-blue px-3 py-1.5 text-xs font-semibold text-white transition-fluid hover:brightness-95 disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="h-3.5 w-3.5" />}
          Usar este frame
        </button>
      </div>
      {err && <p className="mt-2 text-xs font-medium text-rose-600">{err}</p>}
    </div>
  );
}
