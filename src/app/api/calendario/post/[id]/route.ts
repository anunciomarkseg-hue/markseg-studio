import { NextResponse } from "next/server";
import { supabaseConfigured } from "@/lib/supabase";
import { setCalendarPostStatus, type CalendarPostStatus } from "@/lib/calendar";

export const dynamic = "force-dynamic";

const VALID: CalendarPostStatus[] = ["pendente", "publicado", "erro", "atrasado"];

/** Marca o status de publicação de um post do calendário visual (manual). */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!supabaseConfigured) return NextResponse.json({ error: "Supabase não configurado" }, { status: 500 });
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as { status?: string };
  if (!body.status || !VALID.includes(body.status as CalendarPostStatus)) {
    return NextResponse.json({ error: "Status inválido." }, { status: 400 });
  }
  try {
    await setCalendarPostStatus(id, body.status as CalendarPostStatus);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
