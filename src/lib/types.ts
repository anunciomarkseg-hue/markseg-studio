export type Platform = "instagram" | "facebook" | "linkedin" | "tiktok";

export type PostStatus =
  | "rascunho"
  | "agendado"
  | "aguardando" // aguardando aprovação
  | "publicado"
  | "falhou";

export type MediaType = "imagem" | "carrossel" | "video" | "reel" | "story";

export interface SocialAccount {
  id: string;
  platform: Platform;
  handle: string; // @markseg
  name: string; // MarkSeg
  followers: number;
  /** classe de degradê pro avatar placeholder */
  avatar: string;
  /** chave do "cliente": IG e FB do mesmo cliente compartilham (= id da Página). */
  group_key?: string | null;
}

export interface ScheduledPost {
  id: string;
  accountIds: string[];
  caption: string;
  mediaType: MediaType;
  /** classe de degradê pra cada "mídia" (placeholder visual) */
  media: string[];
  scheduledFor: string; // ISO
  status: PostStatus;
  /** @usernames de colaboradores do Instagram (Collab), até 3. */
  collaborators?: string[];
  /** Reel: true = também aparece no feed; false = só na aba Reels. */
  shareToFeed?: boolean;
  /** e-mail de quem agendou (histórico). */
  createdBy?: string | null;
  /** quando foi criado no sistema (ISO). */
  createdAt?: string | null;
}

export const STATUS_LABEL: Record<PostStatus, string> = {
  rascunho: "Rascunho",
  agendado: "Agendado",
  aguardando: "Aguardando aprovação",
  publicado: "Publicado",
  falhou: "Falhou",
};

export const MEDIA_LABEL: Record<MediaType, string> = {
  imagem: "Imagem",
  carrossel: "Carrossel",
  video: "Vídeo",
  reel: "Reel",
  story: "Story",
};
