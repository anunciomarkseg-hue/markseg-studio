/**
 * Lê o TEXTO de uma pauta (PDF já extraído) da MarkSeg e devolve os posts
 * estruturados pra virar cards na pauta editorial. Sem IA/API.
 * Suporta os DOIS modelos:
 *   1) "Pauta detalhada": NN DD/MM (Dia) + blocos DOR/SOLUÇÃO/REFERÊNCIA.
 *   2) "Calendário de Conteúdo" (tabela): # DATA FORMATO TEMA OBJETIVO BRIEFING LEGENDA.
 * O que importa aprovar (data + formato + tema) sai limpo nos dois.
 */
export interface ParsedPautaPost {
  ref: string;
  planned_date: string; // ISO
  format: string; // feed | carrossel | reel | story
  title: string;
  brief: string;
  networks: string[];
}

function mapFormat(raw: string): string {
  const s = (raw || "").toLowerCase();
  if (s.includes("carrossel")) return "carrossel";
  if (s.includes("reel") || s.includes("vídeo") || s.includes("video")) return "reel";
  if (s.includes("story") || s.includes("stories")) return "story";
  return "feed";
}
const join = (a?: string[]) => (a || []).join(" ").replace(/\s+/g, " ").trim();

/** Modelo 1 — "Pauta detalhada" (blocos DOR/SOLUÇÃO). */
function parseDetailed(text: string, year: number): ParsedPautaPost[] {
  const di = text.indexOf("Pautas detalhadas");
  const body = di >= 0 ? text.slice(di) : text;
  const re =
    /(?:^|\n)(?:(\d{2})\s+(\d{2})\/(\d{2})\s*\((?:Segunda|Terça|Quarta|Quinta|Sexta|Sábado|Domingo)[^)]*\)|A(\d+)\s+(\d{2})\/(\d{2})\s*\(Semana[^)]*\))/g;
  const heads = [...body.matchAll(re)];
  const out: ParsedPautaPost[] = [];

  for (let k = 0; k < heads.length; k++) {
    const m = heads[k];
    const isLi = m[4] !== undefined;
    const ref = isLi ? "A" + m[4] : m[1];
    const day = isLi ? m[5] : m[2];
    const month = isLi ? m[6] : m[3];
    const start = (m.index ?? 0) + m[0].length;
    const end = k + 1 < heads.length ? (heads[k + 1].index ?? body.length) : body.length;
    const chunk = body.slice(start, end).replace(/MarkSeg Agência[^\n]*/g, "");
    const lines = chunk.split("\n").map((s) => s.trim());

    let rawTitle = "";
    let formatRaw = "";
    let objetivo = "";
    const sec: Record<string, string[]> = {};
    let curr = "title";
    for (const ln of lines) {
      if (!ln) continue;
      if (/^FORMATO\b/i.test(ln)) {
        const fm = ln.match(/FORMATO\s+(.+?)(?:\s*\|\s*OBJETIVO\s+(.+))?$/i);
        if (fm) {
          formatRaw = fm[1].trim();
          if (fm[2]) objetivo = fm[2].trim();
        }
        curr = "_";
        continue;
      }
      if (/^DOR DE MERCADO/i.test(ln)) { curr = "dor"; continue; }
      if (/^SOLU[ÇC][ÃA]O/i.test(ln)) { curr = "sol"; continue; }
      if (/^REFER[ÊE]NCIA/i.test(ln)) { curr = "brief"; continue; }
      if (/^MENSAGEM DA HOMENAGEM/i.test(ln)) { curr = "homen"; continue; }
      if (/^GANCHO/i.test(ln)) { curr = "dor"; continue; }
      if (/^ESTRUTURA DO ARTIGO/i.test(ln)) { curr = "brief"; continue; }
      if (/^CTA SUGERIDO/i.test(ln)) { curr = "cta"; continue; }
      if (/^(P[ÚU]BLICO-ALVO|TOM\b)/i.test(ln)) { curr = "_"; continue; }
      if (curr === "title") rawTitle += (rawTitle ? " " : "") + ln;
      else (sec[curr] ??= []).push(ln);
    }
    const title = rawTitle.replace(/\s+(ESTÁTICO|CARROSSEL|VÍDEO|ARTIGO LINKEDIN)\s*$/i, "").trim();
    const tag = (rawTitle.match(/(ESTÁTICO|CARROSSEL|VÍDEO)\s*$/i) || [])[1] || "";
    if (!title) continue;
    const brief = [
      objetivo && `🎯 Objetivo: ${objetivo}`,
      join(sec.dor) && `⚠️ Dor de mercado: ${join(sec.dor)}`,
      join(sec.sol) && `✅ Solução: ${join(sec.sol)}`,
      join(sec.homen) && `💛 ${join(sec.homen)}`,
      join(sec.brief) && `🎨 Referência / briefing: ${join(sec.brief)}`,
      join(sec.cta) && `📣 CTA: ${join(sec.cta)}`,
    ]
      .filter(Boolean)
      .join("\n\n");
    out.push({
      ref,
      planned_date: `${year}-${month}-${day}T10:00:00`,
      format: isLi ? "feed" : mapFormat(formatRaw || tag),
      title,
      brief,
      networks: isLi ? ["linkedin"] : ["instagram", "facebook"],
    });
  }
  return out;
}

/** Modelo 2 — "Calendário de Conteúdo" (tabela achatada). */
const FMT_RE = /^(Imagem estática|Imagem|Carrossel|Vídeo\s*\/\s*Reels|Vídeo\s*\(Reels\)|V[íi]deo|Est[áa]tico|Reels?|Story|Stories)\b/i;
// onde o TEMA termina (começa o objetivo/briefing)
const BOUND_RE =
  /\b(Educativo|Produto|Engajamento|Humaniza\S+|Institucional|Convers\S+|Consci\S+|Autoridade|Comercial|Vendas|Relacionamento|Diferencial|Refor\S+|Homenagem|Nutri\S+|Foto real|Foto\b|Arte para|Arte\b|Roteiro|Briefing|slides?|Paleta|IA generativa|\bIA\b|design|Montagem|Split|Cena\b|Mockup|Ilustra|Thumbnail|apresentador)/i;

function parseTable(text: string, year: number): ParsedPautaPost[] {
  const re =
    /(?:^|\n)(\d{1,2})\s+(\d{2})\/(\d{2})\s*\n\s*(?:Segunda|Ter[çc]a|Quarta|Quinta|Sexta|S[áa]bado|Domingo)[^\n]*/gi;
  const heads = [...text.matchAll(re)];
  const out: ParsedPautaPost[] = [];

  for (let k = 0; k < heads.length; k++) {
    const m = heads[k];
    const day = m[2];
    const month = m[3];
    const start = (m.index ?? 0) + m[0].length;
    const end = k + 1 < heads.length ? (heads[k + 1].index ?? text.length) : text.length;
    const lines = text
      .slice(start, end)
      .split("\n")
      .map((x) => x.trim())
      .filter(Boolean)
      .filter((l) => !/^(MarkSeg|Página|Calendário Editorial|G5 Segurança|#\s*DATA|Formatos:|Produção)/i.test(l));
    if (!lines.length) continue;

    let first = lines[0];
    let fmt = "";
    const fm = first.match(FMT_RE);
    if (fm) {
      fmt = fm[1];
      first = first.slice(fm[0].length).trim();
    }
    const tema = [first].filter(Boolean);
    let i = 1;
    for (; i < lines.length; i++) {
      if (BOUND_RE.test(lines[i]) || lines[i].length > 85) break;
      tema.push(lines[i]);
    }
    let title = tema.join(" ").replace(/\s+/g, " ").trim();
    const b = title.match(BOUND_RE);
    if (b && (b.index ?? 0) > 12) title = title.slice(0, b.index).trim();
    title = title.replace(/[\s·\-–|]+$/, "").slice(0, 90).trim();
    if (!title) continue;

    const brief = lines.slice(i).join(" ").replace(/\s+/g, " ").trim();
    out.push({
      ref: String(m[1]),
      planned_date: `${year}-${month}-${day}T10:00:00`,
      format: mapFormat(fmt),
      title,
      brief: brief ? `📋 ${brief}` : "",
      networks: ["instagram", "facebook"],
    });
  }
  return out;
}

/** Modelo 3 — "Calendário" enxuto: 1 linha por post → N DD/MM FORMATO Tema Categoria. */
const COMPACT_LINE =
  /^(\d{1,2})\s+(\d{2})\/(\d{2})\s+(EST[ÁA]TIC[AO]|CARROSSEL|V[ÍI]DEO|REELS?|STORY|STORIES|IMAGEM(?:\s+est[áa]tica)?)\s+(.+)$/i;
const COMPACT_CAT =
  /\s+(Engajamento|Produto|Educativo|Institucional|Convers\S+|Consci\S+|Autoridade|Comercial|Vendas|Relacionamento|Diferencial|Refor\S+|Homenagem|Nutri\S+|Comemorativa)\s*$/i;

function parseCompact(text: string, year: number): ParsedPautaPost[] {
  const out: ParsedPautaPost[] = [];
  for (const raw of text.split("\n")) {
    const m = raw.trim().match(COMPACT_LINE);
    if (!m) continue;
    const [, num, day, month, fmtWord, rest0] = m;
    let rest = rest0.trim();
    let category = "";
    const cm = rest.match(COMPACT_CAT);
    if (cm) {
      category = cm[1];
      rest = rest.slice(0, cm.index).trim();
    }
    const title = rest.replace(/[\s·\-–|]+$/, "").trim();
    if (!title) continue;
    out.push({
      ref: num,
      planned_date: `${year}-${month}-${day}T10:00:00`,
      format: mapFormat(fmtWord),
      title: title.slice(0, 120),
      brief: category ? `📋 ${category}` : "",
      networks: ["instagram", "facebook"],
    });
  }
  return out;
}

/** Modelo 4 — CORINGA (último recurso). Ancora em qualquer data DD/MM e tenta
 *  achar formato + assunto por perto. Cobre layouts novos que os 3 fixos não pegam.
 *  Faz dedup (tabela-resumo + detalhe do mesmo post não viram 2 cards). */
const FMT_ANY = /(imagem est[áa]tic[ao]|est[áa]tic[ao]|carrossel|v[íi]deo(?:\s*\(reels?\))?|reels?|stor(?:y|ies))/i;
const WD_ANY = /\b(segunda|ter[çc]a|quarta|quinta|sexta|s[áa]bado|domingo)\b\.?/gi;
const CATSET = new Set([
  "engajamento", "produto", "educativo", "institucional", "conversao", "conversão", "consciencia", "consciência",
  "autoridade", "comercial", "vendas", "relacionamento", "diferencial", "reforco", "reforço", "homenagem",
  "ancora", "âncora", "comemorativa",
]);
const cw = (w: string) => w.toLowerCase().replace(/[^a-zà-ú]/gi, "");
/** Tira categoria (Educativo/Engajamento/…) grudada no começo ou fim do título. */
function stripCategory(title: string): string {
  let w = title.split(/\s+/);
  if (w.length > 2 && CATSET.has(cw(w[0]))) w = w.slice(1);
  if (w.length > 2 && CATSET.has(cw(w[w.length - 1]))) w = w.slice(0, -1);
  return w.join(" ");
}

function parseGeneric(text: string, year: number): ParsedPautaPost[] {
  const lines = text.split("\n").map((l) => l.trim());
  // Data no começo da linha, com prefixo opcional de nº OU dia da semana ("Seg 03/08").
  const dl = /^(?:(?:seg|ter|qua|qui|sex|s[áa]b|dom)[a-zç]*\.?\s+|\d{1,2}\s+)?(\d{2})\/(\d{2})\b(.*)$/i;
  const anchors: { i: number; day: string; mo: string; rest: string }[] = [];
  lines.forEach((l, i) => {
    const m = l.match(dl);
    if (m && Number(m[1]) <= 31 && Number(m[2]) <= 12) {
      const rest = m[3] || "";
      // só ancora se tiver formato por perto (evita datas soltas no texto corrido)
      if (FMT_ANY.test(rest) || FMT_ANY.test(lines[i + 1] || "") || l.length < 55)
        anchors.push({ i, day: m[1], mo: m[2], rest: rest.trim() });
    }
  });

  const out: ParsedPautaPost[] = [];
  const seen = new Set<string>();
  for (let k = 0; k < anchors.length; k++) {
    const a = anchors[k];
    const endL = k + 1 < anchors.length ? anchors[k + 1].i : Math.min(lines.length, a.i + 8);
    const body = lines
      .slice(a.i + 1, endL)
      .filter(Boolean)
      .filter((l) => !/^(MarkSeg|Página|#\s|■|O que vamos)/i.test(l));
    let head = a.rest;
    if (!head) head = body.shift() || "";
    const fm = head.match(FMT_ANY) || (body[0] || "").match(FMT_ANY);
    const format = fm ? mapFormat(fm[0]) : "feed";

    let title = head.replace(FMT_ANY, " ").replace(WD_ANY, " ").replace(/\s+/g, " ").trim();
    title = stripCategory(title).replace(/^[/\s·\-–|]+/, "").replace(/[\s·\-–|]+$/, "").slice(0, 110).trim();
    if (!title || title.replace(/[^a-zà-ú0-9]/gi, "").length < 6) continue;

    // a DESCRIÇÃO do conteúdo = as linhas de baixo do registro
    const brief = body.join(" ").replace(/\s+/g, " ").trim().slice(0, 500);
    const key = `${a.mo}-${a.day}|${title.slice(0, 24).toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      ref: String(out.length + 1),
      planned_date: `${year}-${a.mo}-${a.day}T10:00:00`,
      format,
      title,
      brief: brief ? `📋 ${brief}` : "",
      networks: ["instagram", "facebook"],
    });
  }
  return out;
}

/** Modelo 5 — seção "Descrição das pautas": número / FORMATO / data / título / descrição.
 *  É o mais rico (traz a descrição do conteúdo) — tem prioridade quando existe. */
const DESC_FMT_LINE = /^(imagem est[áa]tic[ao]|est[áa]tic[ao]|carrossel|v[íi]deo(?:\s*\(reels?\))?|reels?|stor(?:y|ies))$/i;
function parseDescricao(text: string, year: number): ParsedPautaPost[] {
  const s = text.search(/Descri[çc][ãa]o das pautas/i);
  const body = s >= 0 ? text.slice(s) : text;
  const L = body.split("\n").map((x) => x.trim());
  const isHdr = (i: number) =>
    /^\d{1,2}$/.test(L[i]) && DESC_FMT_LINE.test(L[i + 1] || "") && /^\d{2}\/\d{2}$/.test(L[i + 2] || "");
  const out: ParsedPautaPost[] = [];
  for (let i = 0; i < L.length - 3; i++) {
    if (!isHdr(i)) continue;
    const dm = L[i + 2].match(/^(\d{2})\/(\d{2})$/);
    if (!dm) continue;
    const format = mapFormat(L[i + 1]);
    const title = L[i + 3] || "";
    const desc: string[] = [];
    let j = i + 4;
    for (; j < L.length; j++) {
      if (isHdr(j) || /^(MarkSeg|Página)/i.test(L[j])) break;
      if (L[j]) desc.push(L[j]);
    }
    if (title) {
      out.push({
        ref: L[i],
        planned_date: `${year}-${dm[2]}-${dm[1]}T10:00:00`,
        format,
        title: title.slice(0, 140),
        brief: desc.join(" ").replace(/\s+/g, " ").trim().slice(0, 600),
        networks: ["instagram", "facebook"],
      });
    }
    i = j - 1;
  }
  return out;
}

/** Modelo 6 — "Proposta criativa": data POR EXTENSO + formato/categoria + título + descrição.
 *  É o padrão das pautas geradas com IA (ex.: "04 de agosto, terça-feira" / "REELS EDUCATIVO").
 *  Traz a descrição completa de cada post → tem prioridade quando existe data por extenso. */
const MONTHS_PT: Record<string, string> = {
  janeiro: "01", fevereiro: "02", "março": "03", marco: "03", abril: "04", maio: "05", junho: "06",
  julho: "07", agosto: "08", setembro: "09", outubro: "10", novembro: "11", dezembro: "12",
};
const FMT_ANY_TD =
  /(imagem est[áa]tic[ao]|est[áa]tic[ao]|carrossel|v[íi]deo(?:\s*\(reels?\))?|reels?|stor(?:y|ies))/i;
// início provável da DESCRIÇÃO (pra saber onde o título termina quando quebra em 2 linhas)
const DESC_START =
  /^(reels?|imagem|est[áa]tic|carrossel|v[íi]deo|stor(?:y|ies)|foto|arte|montagem|apresentador|ilustra)\b/i;

function parseTextDate(text: string, year: number): ParsedPautaPost[] {
  let body = text;
  // corta seções finais que NÃO são posts (dependências / fluxo de produção)
  const cut = body.search(/O que dependemos do cliente|Resumo do fluxo de produç/i);
  if (cut > 0) body = body.slice(0, cut);
  // começa na "proposta criativa" (a parte rica), se existir
  const s = body.search(/Proposta criativa/i);
  if (s >= 0) body = body.slice(s);

  const L = body.split("\n").map((x) => x.trim());
  const monthNames = Object.keys(MONTHS_PT).join("|");
  const dateRe = new RegExp(`^(?:(\\d{1,2})\\s+)?(\\d{1,2})\\s+de\\s+(${monthNames})\\b`, "i");

  const anchors: { i: number; ref?: string; day: string; month: string }[] = [];
  for (let i = 0; i < L.length; i++) {
    const m = L[i].match(dateRe);
    if (m) {
      let ref = m[1];
      if (!ref && /^\d{1,2}$/.test(L[i - 1] || "")) ref = L[i - 1];
      anchors.push({ i, ref, day: m[2], month: MONTHS_PT[m[3].toLowerCase()] });
    }
  }

  const out: ParsedPautaPost[] = [];
  for (let k = 0; k < anchors.length; k++) {
    const a = anchors[k];
    const end = k + 1 < anchors.length ? anchors[k + 1].i : L.length;
    const lines = L.slice(a.i + 1, end).filter(Boolean);
    if (!lines.length) continue;

    // 1ª linha do bloco = FORMATO (+ categoria)
    const fm = lines[0].match(FMT_ANY_TD);
    const format = fm ? mapFormat(fm[0]) : "feed";

    // título = linhas seguintes até começar a descrição (junta título quebrado em 2 linhas)
    const titleParts: string[] = [];
    let j = 1;
    for (; j < lines.length && titleParts.length < 3; j++) {
      if (titleParts.length >= 1 && DESC_START.test(lines[j])) break;
      titleParts.push(lines[j]);
    }
    const title = titleParts.join(" ").replace(/\s+/g, " ").trim().slice(0, 140);
    if (!title) continue;

    const brief = lines.slice(j).join(" ").replace(/\s+/g, " ").trim().slice(0, 600);
    out.push({
      ref: a.ref || String(out.length + 1),
      planned_date: `${year}-${a.month}-${a.day.padStart(2, "0")}T10:00:00`,
      format,
      title,
      brief: brief ? `📋 ${brief}` : "",
      networks: ["instagram", "facebook"],
    });
  }
  return out;
}

/** Detecta se o texto usa data por extenso ("12 de agosto"). */
function hasTextDate(text: string): boolean {
  return new RegExp(`\\b\\d{1,2}\\s+de\\s+(${Object.keys(MONTHS_PT).join("|")})\\b`, "i").test(text);
}

export function parsePauta(text: string, year: number): ParsedPautaPost[] {
  if (text.includes("Pautas detalhadas")) {
    const d = parseDetailed(text, year);
    if (d.length) return d;
  }
  if (/Descri[çc][ãa]o das pautas/i.test(text)) {
    const dd = parseDescricao(text, year);
    if (dd.length) return dd;
  }
  // pautas com data por extenso (padrão das geradas com IA) — descrição rica
  if (hasTextDate(text)) {
    const td = parseTextDate(text, year);
    if (td.length) return td;
  }
  const table = parseTable(text, year);
  if (table.length) return table;
  const compact = parseCompact(text, year);
  if (compact.length) return compact;
  return parseGeneric(text, year); // coringa: qualquer layout com datas
}

/** Ano do documento (ex.: "Agosto 2026") — cai no ano atual se não achar. */
export function pautaYear(text: string, fallback: number): number {
  const m = text.match(/\b(20\d\d)\b/);
  return m ? Number(m[1]) : fallback;
}
