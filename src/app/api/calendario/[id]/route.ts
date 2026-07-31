import { NextResponse } from "next/server";
import { supabaseConfigured } from "@/lib/supabase";
import { deleteCalendar, updateCalendar } from "@/lib/calendar";

export const dynamic = "force-dynamic";

/** Renomear o calendário ou trocar o tema do mês. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!supabaseConfigured) return NextResponse.json({ error: "Supabase não configurado" }, { status: 500 });
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as { title?: string; theme?: string; client_name?: string };
  const patch: { title?: string; theme?: string; client_name?: string } = {};
  if (typeof body.title === "string") patch.title = body.title;
  if (typeof body.theme === "string") patch.theme = body.theme;
  if (typeof body.client_name === "string" && body.client_name.trim()) patch.client_name = body.client_name.trim();
  if (!Object.keys(patch).length) {
    return NextResponse.json({ error: "Nada pra atualizar." }, { status: 400 });
  }
  try {
    await updateCalendar(id, patch);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

/** Excluir um calendário (posts caem em cascata). */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!supabaseConfigured) return NextResponse.json({ error: "Supabase não configurado" }, { status: 500 });
  const { id } = await params;
  try {
    await deleteCalendar(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
