/**
 * Lê uma pauta no "PADRÃO MARKSEG STUDIO" em Markdown (.md) e devolve os posts
 * estruturados. Formato FIXO (gerado pela skill do Claude) → leitura 100% exata,
 * sem adivinhação de layout. É o caminho confiável (o PDF fica como plano B).
 *
 *   # Pauta — <Cliente> — <Mês>/<Ano>
 *   Tema do mês: <tema>
 *
 *   ## Post 1
 *   - Data: 2026-08-04
 *   - Formato: reel | carrossel | estático | story
 *   - Título: ...
 *   - Descrição: ...
 */
import type { ParsedPautaPost } from "./pautaPdf";

function mapFormat(raw: string): string {
  const s = (raw || "").toLowerCase();
  if (s.includes("carrossel")) return "carrossel";
  if (s.includes("reel") || s.includes("vídeo") || s.includes("video")) return "reel";
  if (s.includes("story") || s.includes("stories")) return "story";
  return "feed"; // estático / imagem / feed
}

/** Tira acento pra casar rótulos (titulo/título, descricao/descrição). */
const norm = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

export interface ParsedPautaMd {
  client_name: string;
  theme: string;
  posts: ParsedPautaPost[];
}

export function parsePautaMd(text: string): ParsedPautaMd {
  const lines = text.replace(/\r/g, "").split("\n");

  let client_name = "";
  let theme = "";

  // cabeçalho: "# Pauta — <Cliente> — <Mês>/<Ano>"
  const h = lines.find((l) => /^#\s+/.test(l.trim()));
  if (h) {
    const parts = h.replace(/^#\s+/, "").split(/\s+[—–-]\s+/);
    if (parts.length >= 2) client_name = parts[1].trim();
  }
  // "Tema do mês: ..."
  const t = lines.find((l) => /tema\s+do\s+m[êe]s/i.test(l));
  if (t) theme = t.replace(/.*tema\s+do\s+m[êe]s\s*[:\-–]?\s*/i, "").trim();

  // quebra em blocos por "## " (cada bloco = um post)
  const posts: ParsedPautaPost[] = [];
  let cur: string[] | null = null;
  const blocks: string[][] = [];
  for (const raw of lines) {
    if (/^##\s+/.test(raw.trim())) {
      if (cur) blocks.push(cur);
      cur = [];
    } else if (cur) {
      cur.push(raw);
    }
  }
  if (cur) blocks.push(cur);

  const fieldRe = /^\s*[-*]?\s*([A-Za-zÀ-ÿ]+)\s*[:：]\s*(.+)$/;
  const seen = new Set<string>();

  for (const block of blocks) {
    const f: Record<string, string> = {};
    for (const ln of block) {
      const m = ln.match(fieldRe);
      if (!m) continue;
      f[norm(m[1])] = m[2].trim();
    }
    const dateRaw = f["data"] || "";
    const dm = dateRaw.match(/(\d{4})-(\d{2})-(\d{2})/) || dateRaw.match(/(\d{2})\/(\d{2})\/(\d{4})/);
    if (!dm) continue;
    // aceita AAAA-MM-DD ou DD/MM/AAAA
    const iso = dateRaw.includes("/")
      ? `${dm[3]}-${dm[2]}-${dm[1]}`
      : `${dm[1]}-${dm[2]}-${dm[3]}`;

    const title = (f["titulo"] || f["tema"] || "").trim();
    if (!title) continue;

    const key = `${iso}|${title.toLowerCase()}`;
    if (seen.has(key)) continue; // dedup: post idêntico (data+título) não repete
    seen.add(key);

    posts.push({
      ref: String(posts.length + 1),
      planned_date: `${iso}T10:00:00`,
      format: mapFormat(f["formato"] || ""),
      title: title.slice(0, 140),
      brief: (f["descricao"] || f["briefing"] || "").trim().slice(0, 600),
      networks: ["instagram", "facebook"],
    });
  }

  return { client_name, theme, posts };
}

/** true se o texto parece ser o padrão .md (tem "## Post" ou cabeçalho "# Pauta"). */
export function looksLikePautaMd(text: string): boolean {
  return /^#\s+Pauta/im.test(text) || /^##\s+Post/im.test(text);
}
