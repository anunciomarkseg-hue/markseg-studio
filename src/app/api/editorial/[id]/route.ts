import { NextResponse } from "next/server";
import { updateEditorial, deleteEditorial } from "@/lib/editorial";
import { supabaseConfigured } from "@/lib/supabase";
import type { EditorialPost } from "@/lib/editorial";

export const dynamic = "force-dynamic";

const FIELDS = [
  "planned_date",
  "networks",
  "format",
  "title",
  "caption",
  "brief",
  "reference_urls",
  "production_status",
  "approval_status",
  "scheduled_post_id",
] as const;

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!supabaseConfigured) {
    return NextResponse.json({ error: "Supabase não configurado" }, { status: 500 });
  }
  const { id } = await params;
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const patch: Partial<EditorialPost> = {};
  for (const f of FIELDS) {
    if (f in body) (patch as Record<string, unknown>)[f] = body[f];
  }

  try {
    await updateEditorial(id, patch);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!supabaseConfigured) {
    return NextResponse.json({ error: "Supabase não configurado" }, { status: 500 });
  }
  const { id } = await params;
  try {
    await deleteEditorial(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
