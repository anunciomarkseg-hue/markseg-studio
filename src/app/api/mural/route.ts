import { NextResponse } from "next/server";
import { listMural, createMural } from "@/lib/mural";
import { supabaseConfigured } from "@/lib/supabase";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { sendPush } from "@/lib/push";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!supabaseConfigured) return NextResponse.json({ messages: [] });
  try {
    const messages = await listMural();
    return NextResponse.json({ messages });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  if (!supabaseConfigured) {
    return NextResponse.json({ error: "Supabase não configurado" }, { status: 500 });
  }
  // Só o TIME (logado) posta no mural. Todo mundo lê.
  const sb = await createSupabaseServerClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Só o time (logado) pode postar no mural." }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    title?: string;
    author?: string;
    message?: string;
    color?: number;
    urgent?: boolean;
    pinned?: boolean;
    clientId?: string;
  };
  const message = (body.message ?? "").trim();
  if (!message) return NextResponse.json({ error: "Escreva um recado" }, { status: 400 });
  if (message.length > 8000) return NextResponse.json({ error: "Recado muito longo" }, { status: 400 });

  try {
    const author = body.author?.trim()?.slice(0, 40) || null;
    const title = body.title?.trim()?.slice(0, 120) || null;
    const urgent = Boolean(body.urgent);
    const created = await createMural({
      title,
      author,
      message,
      color: typeof body.color === "number" ? body.color : 0,
      urgent,
      pinned: Boolean(body.pinned),
    });
    // Avisa o time (com som). Urgente = notificação grudenta + vibração forte.
    await sendPush(
      {
        title: urgent ? "🚨 RECADO URGENTE — Mural" : "📌 Novo recado no mural",
        body: title || (message.length > 120 ? message.slice(0, 117) + "…" : message),
        url: "/mural",
        tag: urgent ? `mural-urgent-${created.id}` : "mural",
        urgent,
        requireInteraction: urgent,
      },
      body.clientId,
    ).catch(() => {});
    return NextResponse.json({ ok: true, message: created }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
