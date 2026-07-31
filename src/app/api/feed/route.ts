import { NextResponse } from "next/server";
import { listFeed, createFeedPost } from "@/lib/feed";
import { supabaseConfigured } from "@/lib/supabase";
import { sendPush } from "@/lib/push";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!supabaseConfigured) return NextResponse.json({ posts: [] });
  const me = new URL(req.url).searchParams.get("me");
  try {
    const posts = await listFeed(me);
    return NextResponse.json({ posts });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  if (!supabaseConfigured) return NextResponse.json({ error: "Supabase não configurado" }, { status: 500 });
  const b = (await req.json().catch(() => ({}))) as {
    name?: string;
    role?: string;
    message?: string;
    clientId?: string;
  };
  const name = (b.name ?? "").trim();
  const message = (b.message ?? "").trim();
  if (!name) return NextResponse.json({ error: "Faça seu cadastro rápido (nome + cargo)" }, { status: 400 });
  if (!message) return NextResponse.json({ error: "Escreva algo" }, { status: 400 });

  try {
    const post = await createFeedPost({ author_name: name, author_role: b.role?.trim() || null, message });
    await sendPush(
      {
        title: `${name} postou nas Conversas`,
        body: message.length > 120 ? message.slice(0, 117) + "…" : message,
        url: "/conversas",
        tag: "feed-post",
      },
      b.clientId,
    ).catch(() => {});
    return NextResponse.json({ ok: true, post }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
