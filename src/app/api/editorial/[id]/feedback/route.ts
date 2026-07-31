import { NextResponse } from "next/server";
import { listFeedbackForPost } from "@/lib/editorial";
import { supabaseConfigured } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!supabaseConfigured) {
    return NextResponse.json({ error: "Supabase não configurado" }, { status: 500 });
  }
  const { id } = await params;
  try {
    const feedback = await listFeedbackForPost(id);
    return NextResponse.json({ feedback });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
