import { NextResponse } from "next/server";
import { getSupabaseAdmin, supabaseConfigured } from "@/lib/supabase";
import { getActiveGroup } from "@/lib/active";
import { createEditorial } from "@/lib/editorial";
import { parsePauta, pautaYear } from "@/lib/pautaPdf";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

/** Importa uma pauta em PDF (padrão MarkSeg) e cria os cards na pauta do cliente ATIVO. */
export async function POST(req: Request) {
  if (!supabaseConfigured) return NextResponse.json({ error: "Supabase não configurado" }, { status: 500 });

  const group = await getActiveGroup();
  if (!group) {
    return NextResponse.json({ error: "Selecione um cliente no topo antes de importar a pauta." }, { status: 400 });
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Envie o arquivo PDF da pauta." }, { status: 400 });
  }
  if (!/\.pdf$/i.test(file.name) && file.type !== "application/pdf") {
    return NextResponse.json({ error: "O arquivo precisa ser um PDF." }, { status: 400 });
  }

  let text = "";
  try {
    const { extractText, getDocumentProxy } = await import("unpdf");
    const buf = new Uint8Array(await file.arrayBuffer());
    const pdf = await getDocumentProxy(buf);
    const res = await extractText(pdf, { mergePages: true });
    text = res.text;
  } catch (e) {
    return NextResponse.json({ error: "Não consegui ler o PDF: " + (e as Error).message }, { status: 500 });
  }

  const year = pautaYear(text, new Date().getFullYear());
  const posts = parsePauta(text, year);
  if (!posts.length) {
    return NextResponse.json(
      { error: "Não encontrei posts nesse PDF. Ele segue o modelo de pauta da MarkSeg (com datas e blocos DOR/SOLUÇÃO)?" },
      { status: 422 },
    );
  }

  // ADAPTÁVEL: cada post importado segue as REDES REAIS do cliente (não fixo).
  const sb = getSupabaseAdmin();
  const { data: accts } = await sb.from("social_accounts").select("id, platform, group_key");
  const clientPlatforms = [
    ...new Set((accts ?? []).filter((a) => (a.group_key || a.id) === group).map((a) => a.platform as string)),
  ];
  const igfb = clientPlatforms.filter((p) => p === "instagram" || p === "facebook");
  const hasLinkedin = clientPlatforms.includes("linkedin");
  const networksFor = (isArticle: boolean): string[] => {
    if (isArticle) return hasLinkedin ? ["linkedin"] : igfb.length ? igfb : clientPlatforms;
    if (igfb.length) return igfb;
    return clientPlatforms.length ? clientPlatforms : ["instagram"];
  };

  // Anti-duplicação: se reimportar o mesmo PDF, não cria cards repetidos.
  const { data: existing } = await sb.from("editorial_posts").select("planned_date, title").eq("group_key", group);
  const seen = new Set(
    (existing ?? []).map((e) => `${new Date(e.planned_date).toISOString().slice(0, 10)}|${(e.title || "").trim().toLowerCase()}`),
  );

  let created = 0;
  let skipped = 0;
  for (const p of posts) {
    const key = `${p.planned_date.slice(0, 10)}|${p.title.trim().toLowerCase()}`;
    if (seen.has(key)) {
      skipped++;
      continue;
    }
    seen.add(key);
    const isArticle = p.networks.includes("linkedin");
    try {
      await createEditorial({
        group_key: group,
        planned_date: p.planned_date,
        networks: networksFor(isArticle),
        format: p.format,
        title: p.title,
        caption: "",
        brief: p.brief,
        reference_urls: [],
        production_status: "briefing",
      });
      created++;
    } catch {
      /* pula um card que falhar, segue os outros */
    }
  }

  return NextResponse.json({ ok: true, created, skipped, total: posts.length });
}
