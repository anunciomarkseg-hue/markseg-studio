"use client";

import type { PostStatus } from "./types";

export type PostStatusInfo = {
  status?: PostStatus;
  total?: number;
  publicados?: number;
  falhou?: number;
  processando?: number;
  primeiroErro?: string | null;
};

const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Consulta o que REALMENTE aconteceu com um post.
 *
 * Usado quando a resposta do servidor se perde (a função é cortada por tempo,
 * comum em Reel/vídeo): em vez de assustar o usuário com um erro falso — e
 * fazer ele publicar duplicado —, acompanha o estado real por alguns segundos.
 *
 * Devolve o último estado conhecido, ou null se seguiu processando até o fim
 * da espera (aí o post está no forno do Instagram e vai concluir sozinho).
 */
export async function acompanharPost(
  postId: string,
  onProgresso?: (info: PostStatusInfo) => void,
): Promise<PostStatusInfo | null> {
  for (let i = 0; i < 12; i++) {
    await espera(i === 0 ? 1500 : 4000);
    try {
      const res = await fetch(`/api/posts/${postId}/status`, { cache: "no-store" });
      if (!res.ok) continue;
      const info = (await res.json()) as PostStatusInfo;
      onProgresso?.(info);
      if (!info.processando) return info; // nada mais no forno → resultado final
    } catch {
      /* rede instável — tenta de novo */
    }
  }
  return null;
}
