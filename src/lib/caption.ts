/**
 * Gerador de legendas SEM IA / SEM chave — monta a legenda por modelos.
 * Roda no navegador, custo zero. Não "entende" o texto: enriquece o que o
 * usuário escreveu (gancho + corpo + CTA + hashtags) e varia a cada clique.
 */

const HOOKS = [
  "Você sabia? 👇",
  "Fica a dica 👇",
  "Presta atenção nisso 👀",
  "A real é essa 👇",
  "Bora falar sobre isso? 💬",
  "Anota aí 📝",
  "Isso faz diferença 👇",
  "Vem entender 👇",
];

const CTAS = [
  "📲 Chama a gente no direct pra saber mais!",
  "💬 Comenta aqui o que você achou.",
  "🔖 Salva esse post pra não esquecer.",
  "👥 Marca alguém que precisa ver isso.",
  "🔗 Fala com a gente — link na bio.",
  "👉 Ficou com dúvida? A gente te ajuda.",
];

const CTAS_LINKEDIN = [
  "Entre em contato para saber mais.",
  "Comente sua opinião abaixo.",
  "Compartilhe com quem precisa dessa informação.",
  "Fale com nossa equipe.",
];

// pacotes de hashtags evergreen por rotação (genéricos, sem assumir nicho)
const TAG_PACKS = [
  ["#dica", "#novidade"],
  ["#atendimento", "#qualidade"],
  ["#negócios", "#resultado"],
  ["#confiança", "#parceria"],
];

const STOP = new Set(
  "de a o que e do da em um para pra com nao não uma os no se na por mais as dos como mas ao ele das seu sua ou quando muito nos ja já também so só pelo pela ate até isso ela entre era depois sem mesmo aos seus quem nas esse eles voce você essa num nem suas meu minha tem ser vai são está".split(
    " ",
  ),
);

/** Extrai hashtags a partir das palavras relevantes do texto. */
function hashtagsFrom(seed: string): string[] {
  const words = (seed.toLowerCase().match(/[a-zà-ú0-9]{4,}/gi) ?? [])
    .map((w) => w.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]/gi, ""))
    .filter((w) => w.length >= 4 && !STOP.has(w));
  return [...new Set(words)].slice(0, 4).map((w) => `#${w}`);
}

export interface CaptionOpts {
  seed: string; // o que o usuário já escreveu (pode ser vazio)
  platform: string; // instagram | facebook | linkedin | tiktok
  client?: string; // nome do cliente selecionado
  variant: number; // muda a cada clique -> variação
}

export function suggestCaption({ seed, platform, client, variant }: CaptionOpts): string {
  const v = Math.abs(variant);
  const pick = <T>(arr: T[]) => arr[v % arr.length];

  const clean = seed.trim();
  const isLinkedin = platform === "linkedin";
  const isTiktok = platform === "tiktok";

  // corpo: usa o que a pessoa escreveu; se vazio, uma linha genérica
  const core =
    clean ||
    (client
      ? `Novidade da ${client} chegando pra você. Conteúdo pensado pra quem busca qualidade e confiança.`
      : "Conteúdo novo chegando pra você. A gente caprichou nessa 👇");

  const cta = isLinkedin ? pick(CTAS_LINKEDIN) : pick(CTAS);

  // hashtags: derivadas do texto + pacote evergreen (LinkedIn usa menos)
  const derived = hashtagsFrom(clean || core);
  const tags = isLinkedin
    ? derived.slice(0, 3)
    : [...derived, ...pick(TAG_PACKS)].filter((t, i, a) => a.indexOf(t) === i).slice(0, 6);

  // TikTok = curtinho, hashtag junto; sem gancho separado
  if (isTiktok) {
    return `${core}\n\n${tags.join(" ")}`.trim();
  }

  // LinkedIn = mais sóbrio, sem gancho "clickbait"
  if (isLinkedin) {
    return `${core}\n\n${cta}${tags.length ? `\n\n${tags.join(" ")}` : ""}`.trim();
  }

  // Instagram / Facebook = gancho + corpo + CTA + hashtags
  const hook = pick(HOOKS);
  // se o texto já começa "grande", não repete gancho
  const opensBig = clean.length > 60;
  const parts = [opensBig ? "" : hook, core, cta, tags.join(" ")].filter(Boolean);
  return parts.join("\n\n").trim();
}
