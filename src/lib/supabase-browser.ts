"use client";

import { createClient } from "@supabase/supabase-js";

/**
 * Cliente do Supabase pro NAVEGADOR (usa a ANON KEY pública).
 * Serve só pra upload direto no Storage via URL assinada — assim o vídeo
 * não passa pela função da Vercel (que limita o corpo em 4,5 MB).
 */
export const supabaseBrowser = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

/**
 * Sobe um arquivo direto pro Storage (sem limite de tamanho da Vercel):
 *  1. pede uma URL assinada de upload pro servidor
 *  2. envia o arquivo direto pro Supabase
 *  3. devolve a URL pública + se é vídeo
 */
export type UploadStage = { stage: "compress" | "upload"; pct?: number };

async function signFor(file: File) {
  const res = await fetch("/api/upload/sign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ filename: file.name, contentType: file.type }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? "Falha ao preparar o upload");
  return json as { backend: string; path: string; token?: string; uploadUrl?: string; publicUrl: string; maxBytes: number };
}

export async function uploadMediaDirect(
  file: File,
  onStage?: (s: UploadStage) => void,
): Promise<{ url: string; isVideo: boolean }> {
  let sign = await signFor(file);
  const max: number = sign.maxBytes ?? 50 * 1024 * 1024;

  let toUpload = file;
  // Vídeo acima do limite → comprime no navegador (1080p, padrão Instagram)
  if (file.type.startsWith("video") && file.size > max) {
    const { canCompress, compressVideo } = await import("./compress");
    if (!canCompress(file)) {
      throw new Error(
        `Vídeo de ${(file.size / 1048576).toFixed(0)} MB é grande demais pra comprimir aqui. Reduza a duração antes.`,
      );
    }
    onStage?.({ stage: "compress", pct: 0 });
    try {
      toUpload = await compressVideo(file, (pct) => onStage?.({ stage: "compress", pct }));
    } catch {
      throw new Error(
        `Não consegui comprimir esse vídeo de ${(file.size / 1048576).toFixed(0)} MB aqui. ` +
          `Comprima antes no HandBrake ou CapCut (exporte em 1080p) e suba de novo.`,
      );
    }
    // re-assina com o arquivo final (.mp4) pra URL/tipo baterem
    sign = await signFor(toUpload);
    if (toUpload.size > (sign.maxBytes ?? max)) {
      throw new Error(
        `Mesmo comprimido ficou ${(toUpload.size / 1048576).toFixed(0)} MB (limite ${((sign.maxBytes ?? max) / 1048576).toFixed(0)} MB). Reduza a duração do vídeo.`,
      );
    }
  }
  onStage?.({ stage: "upload" });
  file = toUpload;

  if (sign.backend === "r2") {
    // sobe direto pro R2 (PUT na URL pré-assinada)
    if (!sign.uploadUrl) throw new Error("URL de upload do R2 ausente.");
    const up = await fetch(sign.uploadUrl, {
      method: "PUT",
      body: file,
      headers: { "content-type": file.type || "application/octet-stream" },
    });
    if (!up.ok) throw new Error(`Falha ao enviar pro R2 (HTTP ${up.status}).`);
  } else {
    // Supabase Storage
    const { error } = await supabaseBrowser.storage
      .from("media")
      .uploadToSignedUrl(sign.path, sign.token ?? "", file, {
        contentType: file.type || "application/octet-stream",
      });
    if (error) {
      const msg = /exceeded the maximum allowed size|Payload too large/i.test(error.message)
        ? "Arquivo grande demais — o limite atual é 50 MB. Comprima o vídeo e tente de novo."
        : error.message;
      throw new Error(msg);
    }
  }

  return { url: sign.publicUrl as string, isVideo: (file.type || "").startsWith("video") };
}
