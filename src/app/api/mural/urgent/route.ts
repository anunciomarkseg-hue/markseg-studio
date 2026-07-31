import { NextResponse } from "next/server";
import { latestUrgent } from "@/lib/mural";
import { supabaseConfigured } from "@/lib/supabase";

export const dynamic = "force-dynamic";

/** Recado urgente mais recente (24h) pro alerta em tela cheia. Público (time usa sem login). */
export async function GET() {
  if (!supabaseConfigured) return NextResponse.json({ urgent: null });
  try {
    const urgent = await latestUrgent();
    return NextResponse.json({ urgent });
  } catch (e) {
    return NextResponse.json({ urgent: null, error: (e as Error).message });
  }
}
