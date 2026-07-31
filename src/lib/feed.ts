import { getSupabaseAdmin } from "./supabase";

/** Emojis de reação disponíveis nas Conversas. */
export const REACTION_EMOJIS = ["👍", "❤️", "🔥"] as const;
export type ReactionEmoji = (typeof REACTION_EMOJIS)[number];

export interface FeedReaction {
  emoji: string;
  count: number;
  mine: boolean; // se o cliente atual reagiu com esse emoji
}

export interface FeedComment {
  id: string;
  post_id: string;
  author_name: string;
  author_role: string | null;
  message: string;
  created_at: string;
}

export interface FeedPost {
  id: string;
  author_name: string;
  author_role: string | null;
  message: string;
  created_at: string;
  comments: FeedComment[];
  reactions: FeedReaction[];
}

const emptyReactions = (): FeedReaction[] =>
  REACTION_EMOJIS.map((emoji) => ({ emoji, count: 0, mine: false }));

export async function listFeed(clientId?: string | null): Promise<FeedPost[]> {
  const sb = getSupabaseAdmin();
  const { data: posts, error } = await sb
    .from("feed_posts")
    .select("id, author_name, author_role, message, created_at")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw new Error(error.message);

  const ids = (posts ?? []).map((p) => p.id);
  const byPost: Record<string, FeedComment[]> = {};
  const counts: Record<string, Record<string, number>> = {};
  const mine: Record<string, Set<string>> = {};

  if (ids.length) {
    const [{ data: comments }, { data: reacts }] = await Promise.all([
      sb
        .from("feed_comments")
        .select("id, post_id, author_name, author_role, message, created_at")
        .in("post_id", ids)
        .order("created_at", { ascending: true }),
      sb.from("feed_reactions").select("post_id, emoji, client_id").in("post_id", ids),
    ]);
    for (const cmt of (comments ?? []) as FeedComment[]) (byPost[cmt.post_id] ??= []).push(cmt);
    for (const r of (reacts ?? []) as { post_id: string; emoji: string; client_id: string }[]) {
      (counts[r.post_id] ??= {})[r.emoji] = (counts[r.post_id][r.emoji] ?? 0) + 1;
      if (clientId && r.client_id === clientId) (mine[r.post_id] ??= new Set()).add(r.emoji);
    }
  }

  return (posts ?? []).map((p) => ({
    ...(p as Omit<FeedPost, "comments" | "reactions">),
    comments: byPost[p.id] ?? [],
    reactions: REACTION_EMOJIS.map((emoji) => ({
      emoji,
      count: counts[p.id]?.[emoji] ?? 0,
      mine: mine[p.id]?.has(emoji) ?? false,
    })),
  }));
}

export async function createFeedPost(input: {
  author_name: string;
  author_role: string | null;
  message: string;
}): Promise<FeedPost> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("feed_posts")
    .insert({
      author_name: input.author_name.slice(0, 40),
      author_role: input.author_role?.slice(0, 40) || null,
      message: input.message.slice(0, 1500),
    })
    .select("id, author_name, author_role, message, created_at")
    .single();
  if (error) throw new Error(error.message);
  return { ...(data as Omit<FeedPost, "comments" | "reactions">), comments: [], reactions: emptyReactions() };
}

export async function addFeedComment(
  postId: string,
  input: { author_name: string; author_role: string | null; message: string },
): Promise<FeedComment> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("feed_comments")
    .insert({
      post_id: postId,
      author_name: input.author_name.slice(0, 40),
      author_role: input.author_role?.slice(0, 40) || null,
      message: input.message.slice(0, 800),
    })
    .select("id, post_id, author_name, author_role, message, created_at")
    .single();
  if (error) throw new Error(error.message);
  return data as FeedComment;
}

/** Liga/desliga a reação de um cliente num post. Devolve a contagem atualizada. */
export async function toggleReaction(
  postId: string,
  emoji: string,
  clientId: string,
): Promise<FeedReaction[]> {
  if (!REACTION_EMOJIS.includes(emoji as ReactionEmoji)) throw new Error("emoji inválido");
  const sb = getSupabaseAdmin();

  const { data: existing } = await sb
    .from("feed_reactions")
    .select("id")
    .eq("post_id", postId)
    .eq("emoji", emoji)
    .eq("client_id", clientId)
    .maybeSingle();

  if (existing) await sb.from("feed_reactions").delete().eq("id", existing.id);
  else await sb.from("feed_reactions").insert({ post_id: postId, emoji, client_id: clientId });

  const { data: reacts } = await sb
    .from("feed_reactions")
    .select("emoji, client_id")
    .eq("post_id", postId);

  const counts: Record<string, number> = {};
  const mine = new Set<string>();
  for (const r of (reacts ?? []) as { emoji: string; client_id: string }[]) {
    counts[r.emoji] = (counts[r.emoji] ?? 0) + 1;
    if (r.client_id === clientId) mine.add(r.emoji);
  }
  return REACTION_EMOJIS.map((e) => ({ emoji: e, count: counts[e] ?? 0, mine: mine.has(e) }));
}

export async function deleteFeedPost(id: string): Promise<void> {
  const sb = getSupabaseAdmin();
  const { error } = await sb.from("feed_posts").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteFeedComment(id: string): Promise<void> {
  const sb = getSupabaseAdmin();
  const { error } = await sb.from("feed_comments").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
