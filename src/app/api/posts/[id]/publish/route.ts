import { NextResponse } from "next/server";
import { publishPost } from "@/lib/publish";
import { supabaseConfigured } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!supabaseConfigured) {
    return NextResponse.json({ error: "Supabase não configurado" }, { status: 500 });
  }
  const { id } = await params;
  try {
    const result = await publishPost(id);
    if (result.skipped) {
      return NextResponse.json({
        ok: false,
        skipped: true,
        message: "Esse post já está sendo publicado (ou já saiu). Não publiquei de novo pra não duplicar.",
        ...result,
      });
    }
    return NextResponse.json({ ok: result.published > 0, ...result });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
