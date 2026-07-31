import { NextResponse } from "next/server";
import { addMuralRead } from "@/lib/mural";
import { supabaseConfigured } from "@/lib/supabase";

export const dynamic = "force-dynamic";

/** Confirma que a pessoa leu o recado (read receipt). Público — identifica pelo cadastro rápido. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!supabaseConfigured) return NextResponse.json({ error: "Supabase não configurado" }, { status: 500 });
  const { id } = await params;
  const b = (await req.json().catch(() => ({}))) as { clientId?: string; name?: string; role?: string };
  const readerId = (b.clientId ?? "").trim();
  const name = (b.name ?? "").trim();
  if (!readerId) return NextResponse.json({ error: "faltou identificação" }, { status: 400 });
  if (!name) return NextResponse.json({ error: "Diga seu nome pra confirmar a leitura" }, { status: 400 });

  try {
    const reads = await addMuralRead(id, { readerId, name, role: b.role?.trim() || null });
    return NextResponse.json({ ok: true, reads });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
