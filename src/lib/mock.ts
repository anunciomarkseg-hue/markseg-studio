import type { ScheduledPost, SocialAccount } from "./types";

/**
 * Dados de exemplo (mock) só pra dar vida à interface enquanto o
 * back-end (Supabase + Meta API) não está plugado.
 * Depois isso vira chamada ao banco — a UI não muda.
 */

export const ACCOUNTS: SocialAccount[] = [
  {
    id: "ig-markseg",
    platform: "instagram",
    handle: "@markseg",
    name: "MarkSeg",
    followers: 12840,
    avatar: "gradient-orange",
  },
  {
    id: "fb-markseg",
    platform: "facebook",
    handle: "MarkSeg",
    name: "MarkSeg — Marketing para Segurança",
    followers: 8420,
    avatar: "gradient-blue",
  },
];

const MEDIA_POOL = [
  "gradient-blue",
  "gradient-orange",
  "gradient-brand",
];

/** desloca a data de hoje em `days` dias e fixa hora:min */
function at(days: number, hour: number, min = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hour, min, 0, 0);
  return d.toISOString();
}

export const POSTS: ScheduledPost[] = [
  {
    id: "p1",
    accountIds: ["ig-markseg", "fb-markseg"],
    caption:
      "🔒 3 sinais de que sua portaria remota está realmente protegendo o condomínio. Salve esse post! #segurança #portariaremota",
    mediaType: "carrossel",
    media: [MEDIA_POOL[0], MEDIA_POOL[1], MEDIA_POOL[2]],
    scheduledFor: at(0, 10, 30),
    status: "agendado",
  },
  {
    id: "p2",
    accountIds: ["ig-markseg"],
    caption:
      "Bastidores da instalação de CFTV inteligente 👀 Câmeras que avisam ANTES do problema acontecer.",
    mediaType: "reel",
    media: [MEDIA_POOL[1]],
    scheduledFor: at(0, 18, 0),
    status: "aguardando",
  },
  {
    id: "p3",
    accountIds: ["fb-markseg"],
    caption:
      "Alarme monitorado 24h: o que muda na prática pro seu negócio. Comenta aqui se quer um orçamento sem compromisso.",
    mediaType: "imagem",
    media: [MEDIA_POOL[2]],
    scheduledFor: at(1, 9, 0),
    status: "agendado",
  },
  {
    id: "p4",
    accountIds: ["ig-markseg", "fb-markseg"],
    caption:
      "Cliente novo entrou pra família MarkSeg 🧡💙 Bem-vindo! Mais um patrimônio protegido com tecnologia.",
    mediaType: "imagem",
    media: [MEDIA_POOL[0]],
    scheduledFor: at(2, 11, 0),
    status: "agendado",
  },
  {
    id: "p5",
    accountIds: ["ig-markseg"],
    caption: "Dica rápida: troque a senha do seu DVR a cada 90 dias. 🔁",
    mediaType: "story",
    media: [MEDIA_POOL[1]],
    scheduledFor: at(3, 14, 0),
    status: "rascunho",
  },
  {
    id: "p6",
    accountIds: ["ig-markseg", "fb-markseg"],
    caption:
      "Semana passada batemos recorde de atendimentos! Obrigado pela confiança. 🚀",
    mediaType: "carrossel",
    media: [MEDIA_POOL[2], MEDIA_POOL[0]],
    scheduledFor: at(-2, 10, 0),
    status: "publicado",
  },
  {
    id: "p7",
    accountIds: ["fb-markseg"],
    caption: "Promoção de inverno: instalação grátis até sexta. ❄️",
    mediaType: "imagem",
    media: [MEDIA_POOL[1]],
    scheduledFor: at(-1, 16, 0),
    status: "falhou",
  },
  {
    id: "p8",
    accountIds: ["ig-markseg"],
    caption: "Você sabia? 70% dos furtos acontecem em imóveis sem monitoramento.",
    mediaType: "imagem",
    media: [MEDIA_POOL[0]],
    scheduledFor: at(4, 19, 30),
    status: "agendado",
  },
];

export function accountById(id: string): SocialAccount | undefined {
  return ACCOUNTS.find((a) => a.id === id);
}
