import { NextResponse } from "next/server";
import { savePushSub, deletePushSub, pushConfigured, type PushSubInput } from "@/lib/push";
import { supabaseConfigured } from "@/lib/supabase";

export const dynamic = "force-dynamic";

/** Inscreve o aparelho pra receber avisos de mensagem nova. Público. */
export async function POST(req: Request) {
  if (!supabaseConfigured || !pushConfigured())
    return NextResponse.json({ error: "avisos não configurados" }, { status: 503 });

  const b = (await req.json().catch(() => ({}))) as {
    subscription?: PushSubInput;
    clientId?: string;
    name?: string;
  };
  if (!b.subscription?.endpoint || !b.subscription.keys?.p256dh || !b.subscription.keys?.auth)
    return NextResponse.json({ error: "inscrição inválida" }, { status: 400 });

  try {
    await savePushSub(b.subscription, b.clientId ?? null, b.name ?? null);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

/** Cancela os avisos desse aparelho. */
export async function DELETE(req: Request) {
  if (!supabaseConfigured) return NextResponse.json({ ok: true });
  const b = (await req.json().catch(() => ({}))) as { endpoint?: string };
  if (b.endpoint) await deletePushSub(b.endpoint).catch(() => {});
  return NextResponse.json({ ok: true });
}
