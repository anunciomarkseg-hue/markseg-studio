import { NextResponse } from "next/server";
import { setMonthTheme } from "@/lib/editorial";
import { supabaseConfigured } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!supabaseConfigured) {
    return NextResponse.json({ error: "Supabase não configurado" }, { status: 500 });
  }
  const body = (await req.json().catch(() => ({}))) as {
    group_key?: string;
    ym?: string;
    theme?: string;
  };
  if (!body.group_key || !body.ym) {
    return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  }
  try {
    await setMonthTheme(body.group_key, body.ym, body.theme ?? "");
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
