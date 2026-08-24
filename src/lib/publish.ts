import { getSupabaseAdmin } from "./supabase";
import {
  publishToInstagram,
  publishToFacebookPage,
  createReelContainer,
  getContainerStatus,
  publishContainer,
  publishStoryToInstagram,
  publishStoryToFacebookPage,
  publishCarouselToInstagram,
  publishCarouselToFacebook,
  findRecentPublished,
  findPublishedNearTime,
  sleep,
} from "./meta";
import { publishToLinkedIn } from "./linkedin";
import { ensureTikTokToken, publishToTikTokVideo } from "./tiktok";

/**
 * GUARDA ANTI-DUPLICAÇÃO POR MÍDIA (à prova de legenda vazia ou diferente).
 * Procura, na PRÓPRIA conta, um alvo JÁ PUBLICADO por OUTRO post que usa o
 * MESMO arquivo de mídia nas últimas 12h. Se achar, devolve o id externo dele
 * pra ser adotado — impede o mesmo vídeo/imagem sair 2x no feed quando existem
 * dois posts com a mesma mídia (ex.: duplo-envio no agendamento).
 * Usa o BANCO (não a Graph API), então é confiável mesmo sem legenda.
 */
async function findSiblingPublished(
  sb: ReturnType<typeof getSupabaseAdmin>,
  postId: string,
  accountId: string,
  mediaUrls: string[],
): Promise<string | null> {
  const media = (mediaUrls ?? []).filter((u): u is string => typeof u === "string" && u.startsWith("http"));
  if (media.length === 0) return null;
  const key = JSON.stringify(media);
  const sinceIso = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();

  const { data: sibs } = await sb
    .from("post_targets")
    .select("external_post_id, post_id, published_at")
    .eq("account_id", accountId)
    .eq("status", "publicado")
    .not("external_post_id", "is", null)
    .neq("post_id", postId)
    .gte("published_at", sinceIso);
  if (!sibs || sibs.length === 0) return null;

  const otherIds = [...new Set(sibs.map((s) => s.post_id))];
  const { data: posts } = await sb.from("scheduled_posts").select("id, media_urls").in("id", otherIds);
  const sameMedia = new Set(
    (posts ?? [])
      .filter((p) => {
        const m = (p.media_urls ?? []).filter((u: unknown): u is string => typeof u === "string" && u.startsWith("http"));
        return JSON.stringify(m) === key;
      })
      .map((p) => p.id),
  );
  if (sameMedia.size === 0) return null;
  const hit = sibs.find((s) => sameMedia.has(s.post_id));
  return hit?.external_post_id ?? null;
}

/** Erro que indica token da Meta expirado/invalidado (precisa reconectar). */
function isTokenError(msg: string): boolean {
  return /error validating access token|oauthexception|session has been invalidated|access token.*(expired|invalid)|code 190|malformed access token/i.test(
    msg,
  );
}

export interface PublishResult {
  published: number;
  failed: number;
  processing: number;
  /** true = outro processo já estava publicando (ou já saiu) — não republicou, pra não duplicar. */
  skipped?: boolean;
  details: { accountId: string; ok: boolean; error?: string; externalId?: string }[];
}

/**
 * Publica de verdade um post (Instagram, Facebook e LinkedIn).
 * - Instagram: imagem + Reel (container reaproveitado).
 * - Facebook: imagem + vídeo na Página.
 * - LinkedIn: texto + imagem na Página de empresa (vídeo depois).
 */
export async function publishPost(postId: string): Promise<PublishResult> {
  const sb = getSupabaseAdmin();
  // Orçamento de tempo da função (a Vercel corta em maxDuration=60s). Paramos de
  // esperar o Reel processar bem ANTES disso e retornamos "processando" com
  // elegância — assim a plataforma nunca mata a função no meio (o que fazia a
  // API devolver um texto de erro não-JSON e quebrar o app na hora de publicar).
  const fnStart = Date.now();
  const TIME_BUDGET_MS = 50_000;

  // ── TRAVA ANTI-DUPLICAÇÃO ─────────────────────────────────────────────────
  // Claim ATÔMICO: só UM processo publica cada post por vez. Se outra execução
  // já pegou o post (lock fresco) ou ele já saiu, retorna "skipped" e NÃO
  // republica — é isso que impedia o post de sair 2x no cliente.
  // O lock "vence" sozinho após 5 min (recupera função que morreu no meio).
  const lockNow = new Date().toISOString();
  const staleIso = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const { data: claimed } = await sb
    .from("scheduled_posts")
    .update({ publish_lock: lockNow })
    .eq("id", postId)
    .in("status", ["rascunho", "agendado", "falhou"])
    .or(`publish_lock.is.null,publish_lock.lt.${staleIso}`)
    .select("id");
  if (!claimed || claimed.length === 0) {
    return { published: 0, failed: 0, processing: 0, skipped: true, details: [] };
  }
  // ──────────────────────────────────────────────────────────────────────────

  const { data: post, error: pErr } = await sb
    .from("scheduled_posts")
    .select("id, caption, media_type, media_urls, cover_url, collaborators, share_to_feed")
    .eq("id", postId)
    .single();
  if (pErr || !post) {
    // libera a trava se o post sumiu, pra não ficar preso
    await sb.from("scheduled_posts").update({ publish_lock: null }).eq("id", postId);
    throw new Error("Publicação não encontrada");
  }

  const mediaUrl: string | undefined = (post.media_urls ?? [])[0];
  const isRealMedia = Boolean(mediaUrl && mediaUrl.startsWith("http"));
  const isVideoPost = post.media_type === "reel" || post.media_type === "video";
  const isStory = post.media_type === "story";
  // Story pode ser imagem OU vídeo — detecta pelo arquivo enviado.
  const storyIsVideo = /\.(mp4|mov|m4v|webm)(\?|$)/i.test(mediaUrl ?? "");
  // Carrossel: todas as imagens reais (http) do post.
  const realImages: string[] = (post.media_urls ?? []).filter(
    (u: unknown): u is string => typeof u === "string" && u.startsWith("http"),
  );
  const isCarousel = post.media_type === "carrossel" && realImages.length > 1;

  const { data: targets } = await sb
    .from("post_targets")
    .select("id, account_id, status, ig_container_id, external_post_id")
    .eq("post_id", postId);

  // attempted_at é OPCIONAL: se a coluna existir, ativa a guarda por horário
  // (anti-duplicata de legenda vazia). Se não existir, degrada sem quebrar nada.
  const attemptedMap = new Map<string, string | null>();
  try {
    const { data: att } = await sb
      .from("post_targets")
      .select("id, attempted_at")
      .eq("post_id", postId);
    for (const r of att ?? []) attemptedMap.set(r.id as string, (r.attempted_at as string | null) ?? null);
  } catch {
    /* coluna attempted_at ainda não criada — segue sem a guarda por horário */
  }

  const accountIds = (targets ?? []).map((t) => t.account_id);
  const { data: accounts } = await sb
    .from("social_accounts")
    .select("id, platform, external_id, access_token, refresh_token, token_expires_at")
    .in("id", accountIds.length ? accountIds : ["00000000-0000-0000-0000-000000000000"]);
  const accById = new Map((accounts ?? []).map((a) => [a.id, a]));

  const details: PublishResult["details"] = [];
  let published = 0;
  let failed = 0;
  let processing = 0;
  const now = new Date().toISOString();

  for (const t of targets ?? []) {
    // Reforço anti-duplicação: alvo que já tem ID externo NUNCA é republicado.
    if (t.status === "publicado" || t.external_post_id) {
      published++;
      details.push({ accountId: t.account_id, ok: true, externalId: t.external_post_id ?? undefined });
      continue;
    }
    const acc = accById.get(t.account_id);
    if (!acc) {
      failed++;
      details.push({ accountId: t.account_id, ok: false, error: "conta não encontrada" });
      continue;
    }

    // GUARDA POR MÍDIA: se o MESMO arquivo já saiu nesta conta por OUTRO post
    // (ex.: duplo-envio criou 2 posts do mesmo vídeo), adota o que já saiu e
    // NÃO publica de novo — mesmo que a legenda esteja vazia/diferente.
    const sibling = await findSiblingPublished(sb, postId, t.account_id, post.media_urls ?? []);
    if (sibling) {
      await sb
        .from("post_targets")
        .update({ status: "publicado", external_post_id: sibling, published_at: now, error_message: null, ig_container_id: null })
        .eq("id", t.id);
      published++;
      details.push({ accountId: t.account_id, ok: true, externalId: sibling });
      continue;
    }

    // Marca a hora da 1ª tentativa (âncora da guarda por horário). Se já existe,
    // é RECUPERAÇÃO — a 1ª tentativa pode ter publicado e morrido antes de gravar.
    const attemptedIso = attemptedMap.get(t.id) ?? null;
    const isRecovery = attemptedIso ? Date.now() - new Date(attemptedIso).getTime() > 90_000 : false;
    if (!attemptedIso) {
      try {
        await sb.from("post_targets").update({ attempted_at: now }).eq("id", t.id);
      } catch {
        /* coluna attempted_at ainda não criada — sem stamping, sem quebrar */
      }
    }

    try {
      let externalId = "";

      if (acc.platform === "linkedin") {
        // LinkedIn aceita texto puro; imagem é opcional; vídeo ainda não
        if (isVideoPost) {
          throw new Error("Publicar vídeo no LinkedIn ainda não está ligado (use imagem ou texto).");
        }
        externalId = await publishToLinkedIn(acc.external_id, acc.access_token, {
          text: post.caption ?? "",
          imageUrl: isRealMedia ? mediaUrl : undefined,
        });
      } else if (acc.platform === "tiktok") {
        // TikTok = vídeo (Direct Post). Renova o token antes de publicar.
        if (!isRealMedia) {
          throw new Error("Envie a mídia real antes de publicar (a atual é só um exemplo).");
        }
        if (!isVideoPost) {
          throw new Error("O TikTok só aceita vídeo — selecione um vídeo/Reel pra essa conta.");
        }
        const ttToken = await ensureTikTokToken(acc);
        externalId = await publishToTikTokVideo(ttToken, {
          videoUrl: mediaUrl!,
          caption: post.caption ?? "",
        });
      } else {
        // Instagram / Facebook exigem mídia real
        if (!isRealMedia) {
          throw new Error("Envie a mídia real antes de publicar (a atual é só um exemplo).");
        }

        // GUARDA ANTI-DUPLICAÇÃO: se esse mesmo post (mesma legenda) já foi publicado
        // há pouco nessa conta, ADOTA ele em vez de publicar de novo. Impede o post
        // sair 2x mesmo se a 1ª tentativa foi morta no meio depois de já ter postado.
        const dupByCaption = await findRecentPublished(
          acc.platform as "instagram" | "facebook",
          acc.external_id,
          acc.access_token,
          post.caption ?? "",
        );
        // Legenda vazia/curta não dá pra comparar. Em RECUPERAÇÃO, confirma pelo
        // HORÁRIO: se já saiu um post logo após a 1ª tentativa, adota-o (não republica).
        const dupByTime =
          !dupByCaption && isRecovery && attemptedIso
            ? await findPublishedNearTime(
                acc.platform as "instagram" | "facebook",
                acc.external_id,
                acc.access_token,
                new Date(new Date(attemptedIso).getTime() - 2 * 60 * 1000).toISOString(),
              )
            : null;
        const already = dupByCaption || dupByTime;
        if (already) {
          externalId = already;
        } else if (isCarousel && acc.platform === "instagram") {
          externalId = await publishCarouselToInstagram(acc.external_id, acc.access_token, {
            imageUrls: realImages,
            caption: post.caption ?? "",
            collaborators: post.collaborators || undefined,
          });
        } else if (isCarousel && acc.platform === "facebook") {
          externalId = await publishCarouselToFacebook(acc.external_id, acc.access_token, {
            imageUrls: realImages,
            message: post.caption ?? "",
          });
        } else if (isStory && acc.platform === "instagram") {
          externalId = await publishStoryToInstagram(acc.external_id, acc.access_token, {
            mediaUrl: mediaUrl!,
            isVideo: storyIsVideo,
          });
        } else if (isStory && acc.platform === "facebook") {
          externalId = await publishStoryToFacebookPage(acc.external_id, acc.access_token, {
            mediaUrl: mediaUrl!,
            isVideo: storyIsVideo,
          });
        } else if (acc.platform === "instagram" && isVideoPost) {
          // Reel: cria/reaproveita o container e acompanha o processamento
          let containerId = t.ig_container_id as string | null;
          if (!containerId) {
            containerId = await createReelContainer(acc.external_id, acc.access_token, {
              videoUrl: mediaUrl!,
              caption: post.caption ?? "",
              coverUrl: post.cover_url || undefined,
              collaborators: post.collaborators || undefined,
              shareToFeed: post.share_to_feed === true,
            });
            await sb.from("post_targets").update({ ig_container_id: containerId }).eq("id", t.id);
          }

          let status = await getContainerStatus(containerId, acc.access_token);
          while (status !== "FINISHED" && Date.now() - fnStart < TIME_BUDGET_MS) {
            if (status === "ERROR" || status === "EXPIRED") {
              throw new Error(
                "O Instagram rejeitou o vídeo. Verifique as specs de Reel (MP4/H.264, vertical 9:16, 3s–15min).",
              );
            }
            await sleep(4000);
            status = await getContainerStatus(containerId, acc.access_token);
          }

          if (status !== "FINISHED") {
            processing++;
            details.push({
              accountId: t.account_id,
              ok: false,
              error: "O vídeo ainda está processando — clique em Publicar agora de novo em alguns segundos.",
            });
            continue;
          }

          externalId = await publishContainer(acc.external_id, acc.access_token, containerId);
        } else if (acc.platform === "instagram") {
          externalId = await publishToInstagram(acc.external_id, acc.access_token, {
            imageUrl: mediaUrl!,
            caption: post.caption ?? "",
            collaborators: post.collaborators || undefined,
          });
        } else {
          externalId = await publishToFacebookPage(acc.external_id, acc.access_token, {
            message: post.caption ?? "",
            mediaUrl: mediaUrl,
            isVideo: isVideoPost,
          });
        }
      }

      await sb
        .from("post_targets")
        .update({
          status: "publicado",
          external_post_id: externalId,
          published_at: now,
          error_message: null,
          ig_container_id: null,
        })
        .eq("id", t.id);
      // deu certo → limpa qualquer alerta de token expirado da conta
      if (acc.platform === "instagram" || acc.platform === "facebook") {
        await sb
          .from("social_accounts")
          .update({ needs_reconnect: false, token_error: null })
          .eq("id", acc.id);
      }
      published++;
      details.push({ accountId: t.account_id, ok: true, externalId });
    } catch (e) {
      const msg = (e as Error).message;
      await sb.from("post_targets").update({ status: "falhou", error_message: msg }).eq("id", t.id);
      // token da Meta caducou → marca a conta pra reconectar (aviso proativo)
      if (isTokenError(msg)) {
        await sb
          .from("social_accounts")
          .update({ needs_reconnect: true, token_error: msg.slice(0, 300) })
          .eq("id", t.account_id);
      }
      failed++;
      details.push({ accountId: t.account_id, ok: false, error: msg });
    }
  }

  // Status final:
  // - todos os alvos OK           → "publicado"
  // - algum alvo falhou (parcial) → "agendado" (o cron reprocessa SÓ o que faltou;
  //   os alvos já publicados são pulados pelo external_post_id, não republica)
  // - nada publicou, só processando → "agendado"
  // - tudo falhou                 → "falhou"
  const newStatus =
    published > 0 && failed === 0
      ? "publicado"
      : published > 0 || processing > 0
        ? "agendado"
        : "falhou";
  await sb
    .from("scheduled_posts")
    .update({
      status: newStatus,
      // marca a hora só quando saiu 100%; parcial continua pendente até completar
      published_at: published > 0 && failed === 0 ? now : null,
      publish_lock: null,
    })
    .eq("id", postId);

  return { published, failed, processing, details };
}
