import { NextResponse } from "next/server";
import { addFeedComment } from "@/lib/feed";
import { supabaseConfigured } from "@/lib/supabase";
import { sendPush } from "@/lib/push";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!supabaseConfigured) return NextResponse.json({ error: "Supabase não configurado" }, { status: 500 });
  const { id } = await params;
  const b = (await req.json().catch(() => ({}))) as {
    name?: string;
    role?: string;
    message?: string;
    clientId?: string;
  };
  const name = (b.name ?? "").trim();
  const message = (b.message ?? "").trim();
  if (!name) return NextResponse.json({ error: "Faça seu cadastro rápido (nome + cargo)" }, { status: 400 });
  if (!message) return NextResponse.json({ error: "Escreva um comentário" }, { status: 400 });

  try {
    const comment = await addFeedComment(id, { author_name: name, author_role: b.role?.trim() || null, message });
    await sendPush(
      {
        title: `${name} comentou nas Conversas`,
        body: message.length > 120 ? message.slice(0, 117) + "…" : message,
        url: "/conversas",
        tag: "feed-comment",
      },
      b.clientId,
    ).catch(() => {});
    return NextResponse.json({ ok: true, comment }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
