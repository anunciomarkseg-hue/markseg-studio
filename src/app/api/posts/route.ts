import { NextResponse } from "next/server";
import { createPost, listPosts } from "@/lib/db";
import { supabaseConfigured } from "@/lib/supabase";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { accessLevelOf, canPublish } from "@/lib/access";
import type { MediaType, PostStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

const MEDIA_TYPES: MediaType[] = ["imagem", "carrossel", "video", "reel", "story"];
const STATUSES: PostStatus[] = ["rascunho", "agendado", "aguardando", "publicado", "falhou"];

export async function GET() {
  if (!supabaseConfigured) {
    return NextResponse.json({ error: "Supabase não configurado" }, { status: 500 });
  }
  try {
    const posts = await listPosts();
    return NextResponse.json({ posts });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  if (!supabaseConfigured) {
    return NextResponse.json({ error: "Supabase não configurado" }, { status: 500 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const caption = typeof body.caption === "string" ? body.caption : "";
  const mediaType = body.mediaType as MediaType;
  const media = Array.isArray(body.media) ? (body.media as string[]) : [];
  const scheduledFor = typeof body.scheduledFor === "string" ? body.scheduledFor : "";
  const status = (body.status as PostStatus) ?? "agendado";
  const accountIds = Array.isArray(body.accountIds) ? (body.accountIds as string[]) : [];
  const coverUrl = typeof body.cover_url === "string" ? body.cover_url : null;
  const shareToFeed = body.shareToFeed === true;
  const collaborators = Array.isArray(body.collaborators)
    ? (body.collaborators as unknown[])
        .filter((s): s is string => typeof s === "string")
        .map((s) => s.trim().replace(/^@/, ""))
        .filter(Boolean)
        .slice(0, 3)
    : [];

  // validações simples
  if (!MEDIA_TYPES.includes(mediaType)) {
    return NextResponse.json({ error: "mediaType inválido" }, { status: 400 });
  }
  if (!STATUSES.includes(status)) {
    return NextResponse.json({ error: "status inválido" }, { status: 400 });
  }
  if (!scheduledFor || Number.isNaN(Date.parse(scheduledFor))) {
    return NextResponse.json({ error: "Data/hora inválida" }, { status: 400 });
  }
  if (accountIds.length === 0) {
    return NextResponse.json({ error: "Selecione pelo menos uma conta" }, { status: 400 });
  }

  // Nível "Visualização" não cria/agenda posts (só admin e editor).
  // Falha FECHADA: se a sessão não puder ser lida, recusa. Antes o erro caía no
  // catch e a requisição seguia — quem não tinha permissão publicava assim.
  let createdBy: string | null = null;
  let podePublicar = false;
  try {
    const sb = await createSupabaseServerClient();
    const {
      data: { user },
    } = await sb.auth.getUser();
    createdBy = user?.email ?? null;
    podePublicar = canPublish(accessLevelOf(user));
  } catch {
    podePublicar = false;
  }
  if (!podePublicar) {
    return NextResponse.json(
      { error: "Seu nível de acesso não permite criar publicações. Fale com um admin." },
      { status: 403 },
    );
  }

  try {
    const id = await createPost({ caption, mediaType, media, scheduledFor, status, accountIds, coverUrl, collaborators, shareToFeed, createdBy });
    return NextResponse.json({ ok: true, id }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
