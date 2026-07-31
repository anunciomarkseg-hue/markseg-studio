import { NextResponse } from "next/server";
import { getSupabaseAdmin, supabaseConfigured } from "@/lib/supabase";
import { r2PathFromUrl, deleteFromR2, r2Configured } from "@/lib/r2";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const GRACE_DAYS = 2; // apaga a mídia só X dias DEPOIS de publicar

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const url = new URL(req.url);
  return (
    url.searchParams.get("secret") === secret ||
    req.headers.get("authorization") === `Bearer ${secret}`
  );
}

/** Extrai o caminho dentro do bucket "media" a partir da URL pública. */
function pathFromUrl(u: unknown): string | null {
  if (typeof u !== "string") return null;
  const m = u.match(/\/storage\/v1\/object\/public\/media\/(.+)$/);
  return m ? decodeURIComponent(m[1]) : null;
}

/**
 * Apaga do Storage a mídia de posts já publicados há mais de GRACE_DAYS dias.
 * O Instagram/Facebook já têm a cópia — a nossa vira lixo. Chamado pelo pg_cron.
 */
async function run(req: Request) {
  if (!supabaseConfigured) {
    return NextResponse.json({ error: "Supabase não configurado" }, { status: 500 });
  }
  if (!authorized(req)) {
    return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  }

  const sb = getSupabaseAdmin();
  const cutoff = new Date(Date.now() - GRACE_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { data: posts, error } = await sb
    .from("scheduled_posts")
    .select("id, media_urls, cover_url")
    .eq("status", "publicado")
    .eq("media_deleted", false)
    .lt("published_at", cutoff)
    .limit(50);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let cleaned = 0;
  let filesRemoved = 0;

  for (const p of posts ?? []) {
    const urls = [...((p.media_urls ?? []) as unknown[]), p.cover_url].filter(
      (u): u is string => typeof u === "string" && u.startsWith("http"),
    );

    // separa por onde está guardado
    const supaPaths = urls.map(pathFromUrl).filter((x): x is string => Boolean(x));
    const r2Paths = r2Configured
      ? urls.map(r2PathFromUrl).filter((x): x is string => Boolean(x))
      : [];

    try {
      if (supaPaths.length) {
        const { error: rmErr } = await sb.storage.from("media").remove(supaPaths);
        if (rmErr) continue;
        filesRemoved += supaPaths.length;
      }
      if (r2Paths.length) {
        await deleteFromR2(r2Paths);
        filesRemoved += r2Paths.length;
      }
    } catch {
      continue; // tenta de novo no próximo ciclo
    }

    await sb.from("scheduled_posts").update({ media_deleted: true }).eq("id", p.id);
    cleaned++;
  }

  return NextResponse.json({ ok: true, cleaned, filesRemoved });
}

export async function GET(req: Request) {
  return run(req);
}
export async function POST(req: Request) {
  return run(req);
}
