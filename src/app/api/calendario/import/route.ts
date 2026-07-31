import { NextResponse } from "next/server";
import { supabaseConfigured, getSupabaseAdmin } from "@/lib/supabase";
import { getActiveGroup } from "@/lib/active";
import { createCalendar, type NewCalendarPost } from "@/lib/calendar";
import { parsePauta, pautaYear } from "@/lib/pautaPdf";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const MONTHS_PT = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

/** Mês predominante (1-12) entre os posts — vira o "mês" do calendário. */
function dominantMonth(posts: NewCalendarPost[]): number {
  const count: Record<number, number> = {};
  for (const p of posts) {
    const m = new Date(p.planned_date).getMonth() + 1;
    count[m] = (count[m] ?? 0) + 1;
  }
  let best = new Date().getMonth() + 1;
  let max = -1;
  for (const [m, c] of Object.entries(count)) {
    if (c > max) {
      max = c;
      best = Number(m);
    }
  }
  return best;
}

/** Tenta achar o "tema do mês" no texto do PDF (opcional; editável depois). */
function detectTheme(text: string): string {
  const m = text.match(/tema\s+do\s+m[êe]s\s*[:\-–]\s*([^\n]{3,80})/i);
  return m ? m[1].replace(/\s+/g, " ").trim() : "";
}

/**
 * Sobe UMA pauta em PDF e cria um CALENDÁRIO EDITORIAL VISUAL do cliente ativo.
 * Diferente de /api/editorial/import (aquele é o fluxo de aprovação post a post).
 * Aqui é só pra visualizar e compartilhar com o cliente.
 */
export async function POST(req: Request) {
  if (!supabaseConfigured) {
    return NextResponse.json({ error: "Supabase não configurado" }, { status: 500 });
  }

  const group = await getActiveGroup();
  if (!group) {
    return NextResponse.json(
      { error: "Selecione um cliente no topo antes de subir a pauta." },
      { status: 400 },
    );
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
  const parsed = parsePauta(text, year);
  if (!parsed.length) {
    return NextResponse.json(
      {
        error:
          "Não encontrei posts nesse PDF. Ele precisa ter datas (DD/MM) e os posts do mês. Confira se é a pauta certa.",
      },
      { status: 422 },
    );
  }

  // As redes de cada post seguem as REDES REAIS do cliente ativo.
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

  const posts: NewCalendarPost[] = parsed.map((p) => ({
    ref: p.ref,
    planned_date: p.planned_date,
    format: p.format,
    title: p.title,
    brief: p.brief,
    networks: networksFor(p.networks.includes("linkedin")),
  }));

  const month = dominantMonth(posts);
  const refYear = new Date(posts[0].planned_date).getFullYear() || year;
  const title = `${MONTHS_PT[month - 1]} ${refYear}`;
  const theme = detectTheme(text);

  try {
    const { id, token } = await createCalendar(
      {
        group_key: group,
        title,
        theme,
        ref_year: refYear,
        ref_month: month,
        source_name: file.name,
      },
      posts,
    );
    return NextResponse.json({ ok: true, id, token, created: posts.length, title });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
