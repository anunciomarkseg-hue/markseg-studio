import { NextResponse } from "next/server";
import { getSupabaseAdmin, supabaseConfigured } from "@/lib/supabase";
import { r2Configured, presignR2Put, r2PublicUrl } from "@/lib/r2";

export const dynamic = "force-dynamic";

const MB = 1024 * 1024;

/**
 * Prepara o upload direto (sem passar pela função da Vercel).
 * - Se o R2 estiver configurado: URL pré-assinada do R2 (aguenta vídeo grande, grátis).
 * - Senão: URL assinada do Supabase Storage (limite de 50 MB do plano grátis).
 */
export async function POST(req: Request) {
  const { filename, contentType } = (await req.json().catch(() => ({}))) as {
    filename?: string;
    contentType?: string;
  };

  const ext = (filename?.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "");
  const path = `uploads/${crypto.randomUUID()}.${ext}`;
  const isVideo = (contentType || "").startsWith("video");

  // ===== R2 (preferido quando disponível) =====
  if (r2Configured) {
    try {
      const uploadUrl = await presignR2Put(path, contentType || "application/octet-stream");
      return NextResponse.json({
        backend: "r2",
        path,
        uploadUrl,
        publicUrl: r2PublicUrl(path),
        maxBytes: 500 * MB,
        isVideo,
      });
    } catch (e) {
      return NextResponse.json({ error: `Falha ao preparar o upload no R2: ${(e as Error).message}` }, { status: 500 });
    }
  }

  // ===== Supabase Storage (fallback) =====
  if (!supabaseConfigured) {
    return NextResponse.json({ error: "Storage não configurado" }, { status: 500 });
  }
  const sb = getSupabaseAdmin();
  const { data, error } = await sb.storage.from("media").createSignedUploadUrl(path);
  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "Falha ao assinar upload" }, { status: 500 });
  }
  const { data: pub } = sb.storage.from("media").getPublicUrl(path);
  return NextResponse.json({
    backend: "supabase",
    path: data.path,
    token: data.token,
    publicUrl: pub.publicUrl,
    maxBytes: 50 * MB,
    isVideo,
  });
}
