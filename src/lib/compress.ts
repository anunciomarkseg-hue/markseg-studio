"use client";

import type { FFmpeg } from "@ffmpeg/ffmpeg";

/**
 * Compressão de vídeo NO NAVEGADOR (ffmpeg.wasm) — reduz o Reel pro padrão do
 * Instagram (1080p / H.264 / CRF 25) sem perda visível, pra caber no limite.
 * Carrega o core sob demanda (CDN) só quando precisa.
 */

let ff: FFmpeg | null = null;
let loading: Promise<FFmpeg> | null = null;

async function loadFF(): Promise<FFmpeg> {
  if (ff) return ff;
  if (!loading) {
    loading = (async () => {
      const { FFmpeg } = await import("@ffmpeg/ffmpeg");
      const { toBlobURL } = await import("@ffmpeg/util");
      const inst = new FFmpeg();
      const base = "https://unpkg.com/@ffmpeg/core@0.12.10/dist/umd";
      await inst.load({
        coreURL: await toBlobURL(`${base}/ffmpeg-core.js`, "text/javascript"),
        wasmURL: await toBlobURL(`${base}/ffmpeg-core.wasm`, "application/wasm"),
      });
      ff = inst;
      return inst;
    })();
  }
  return loading;
}

/** true se dá pra tentar comprimir (evita travar o navegador com arquivo gigante). */
export function canCompress(file: File): boolean {
  return file.type.startsWith("video") && file.size <= 300 * 1024 * 1024;
}

/** Comprime o vídeo pro padrão do Instagram. Retorna um novo File .mp4. */
export async function compressVideo(file: File, onPct?: (pct: number) => void): Promise<File> {
  const inst = await loadFF();
  const { fetchFile } = await import("@ffmpeg/util");

  const onProg = (e: { progress: number }) =>
    onPct?.(Math.max(1, Math.min(99, Math.round((e.progress || 0) * 100))));
  inst.on("progress", onProg);

  try {
    const ext = (file.name.match(/\.[a-z0-9]+$/i)?.[0] || ".mp4").toLowerCase();
    const inName = "input" + ext;
    const outName = "output.mp4";
    await inst.writeFile(inName, await fetchFile(file));
    await inst.exec([
      "-i", inName,
      "-vf", "scale='min(1080,iw)':-2", // no máx 1080 de largura, mantém proporção
      "-c:v", "libx264",
      "-preset", "veryfast",
      "-crf", "25", // qualidade alta, arquivo enxuto
      "-c:a", "aac",
      "-b:a", "128k",
      "-movflags", "+faststart",
      outName,
    ]);
    const data = await inst.readFile(outName);
    inst.deleteFile(inName).catch(() => {});
    inst.deleteFile(outName).catch(() => {});
    const blob = new Blob([data as unknown as BlobPart], { type: "video/mp4" });
    const name = (file.name.replace(/\.[a-z0-9]+$/i, "") || "video") + ".mp4";
    return new File([blob], name, { type: "video/mp4" });
  } finally {
    inst.off("progress", onProg);
  }
}
