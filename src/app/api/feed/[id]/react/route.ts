import { NextResponse } from "next/server";
import { toggleReaction } from "@/lib/feed";
import { supabaseConfigured } from "@/lib/supabase";

export const dynamic = "force-dynamic";

/** Liga/desliga a reação (👍 ❤️ 🔥) de um cliente num post. Público (cadastro rápido). */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!supabaseConfigured) return NextResponse.json({ error: "Supabase não configurado" }, { status: 500 });
  const { id } = await params;
  const b = (await req.json().catch(() => ({}))) as { emoji?: string; clientId?: string };
  const emoji = (b.emoji ?? "").trim();
  const clientId = (b.clientId ?? "").trim();
  if (!emoji || !clientId) return NextResponse.json({ error: "faltou emoji/cliente" }, { status: 400 });

  try {
    const reactions = await toggleReaction(id, emoji, clientId);
    return NextResponse.json({ ok: true, reactions });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
