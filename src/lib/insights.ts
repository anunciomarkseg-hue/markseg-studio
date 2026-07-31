/**
 * Relatórios de orgânico via Meta Insights API (Instagram + Facebook),
 * agregados por CLIENTE (várias redes num relatório só).
 * Métricas 2026: views (substituiu impressões), alcance/entrega, engajamento,
 * salvamentos, compartilhamentos, seguidores + crescimento, top posts.
 */

const GRAPH = `https://graph.facebook.com/${process.env.META_GRAPH_VERSION ?? "v21.0"}`;

async function gget<T>(url: string): Promise<T> {
  const res = await fetch(url);
  const json = (await res.json()) as T & { error?: { message?: string } };
  if ((json as { error?: { message?: string } }).error) {
    throw new Error((json as { error?: { message?: string } }).error?.message ?? "Erro na API de Insights");
  }
  return json;
}

export interface TopPost {
  id: string;
  caption: string;
  thumb: string | null;
  permalink: string;
  platform: "instagram" | "facebook";
  mediaType: string;
  interactions: number;
  reach: number;
}

export interface AccountInsights {
  followers: number;
  followerGrowth: number;
  reach: number;
  views: number;
  interactions: number;
  likes: number;
  comments: number;
  saves: number;
  shares: number;
  profileVisits: number;
  engagementRate: number; // %
  trend: { date: string; value: number }[];
  topPosts: TopPost[];
  delta: { reach: number | null; views: number | null; interactions: number | null; followers: number | null };
  /** dados crus do período anterior, pra agregar e recalcular variações */
  prev: { reach: number; views: number; interactions: number; followersStart: number };
  networks: ("instagram" | "facebook")[];
}

function range(days: number) {
  const until = Math.floor(Date.now() / 1000);
  return { since: until - days * 86400, until, prevUntil: until - days * 86400, prevSince: until - 2 * days * 86400 };
}

function empty(): AccountInsights {
  return {
    followers: 0,
    followerGrowth: 0,
    reach: 0,
    views: 0,
    interactions: 0,
    likes: 0,
    comments: 0,
    saves: 0,
    shares: 0,
    profileVisits: 0,
    engagementRate: 0,
    trend: [],
    topPosts: [],
    delta: { reach: null, views: null, interactions: null, followers: null },
    prev: { reach: 0, views: 0, interactions: 0, followersStart: 0 },
    networks: [],
  };
}

interface TotalValueResp {
  data?: { name: string; total_value?: { value: number } }[];
}
interface TimeSeriesResp {
  data?: { name: string; values?: { value: number; end_time: string }[] }[];
}

function pct(cur: number, prev: number): number | null {
  return prev > 0 ? Math.round(((cur - prev) / prev) * 100) : null;
}

export async function getInstagramInsights(
  igUserId: string,
  token: string,
  days: number,
): Promise<AccountInsights> {
  const out = empty();
  out.networks = ["instagram"];
  const { since, until, prevSince, prevUntil } = range(days);

  try {
    const prof = await gget<{ followers_count?: number }>(
      `${GRAPH}/${igUserId}?fields=followers_count&access_token=${token}`,
    );
    out.followers = prof.followers_count ?? 0;
  } catch {}

  async function totals(s: number, u: number) {
    const metrics = "reach,views,total_interactions,likes,comments,saves,shares,profile_links_taps";
    const tv = await gget<TotalValueResp>(
      `${GRAPH}/${igUserId}/insights?metric=${metrics}&metric_type=total_value&period=day&since=${s}&until=${u}&access_token=${token}`,
    );
    const m: Record<string, number> = {};
    for (const d of tv.data ?? []) m[d.name] = d.total_value?.value ?? 0;
    return m;
  }

  try {
    const m = await totals(since, until);
    out.reach = m.reach ?? 0;
    out.views = m.views ?? 0;
    out.likes = m.likes ?? 0;
    out.comments = m.comments ?? 0;
    out.saves = m.saves ?? 0;
    out.shares = m.shares ?? 0;
    out.profileVisits = m.profile_links_taps ?? 0;
    out.interactions = m.total_interactions ?? out.likes + out.comments + out.saves + out.shares;
  } catch {}

  try {
    const p = await totals(prevSince, prevUntil);
    out.prev = {
      reach: p.reach ?? 0,
      views: p.views ?? 0,
      interactions: p.total_interactions ?? 0,
      followersStart: 0,
    };
  } catch {}

  try {
    const ts = await gget<TimeSeriesResp>(
      `${GRAPH}/${igUserId}/insights?metric=reach&period=day&since=${since}&until=${until}&access_token=${token}`,
    );
    out.trend = (ts.data?.[0]?.values ?? []).map((v) => ({ date: v.end_time.slice(0, 10), value: v.value }));
  } catch {}

  try {
    const fc = await gget<TimeSeriesResp>(
      `${GRAPH}/${igUserId}/insights?metric=follower_count&period=day&since=${since}&until=${until}&access_token=${token}`,
    );
    out.followerGrowth = (fc.data?.[0]?.values ?? []).reduce((a, v) => a + (v.value || 0), 0);
  } catch {}

  // top publicações com alcance + interações (insights por mídia)
  try {
    const media = await gget<{
      data?: {
        id: string;
        caption?: string;
        media_type?: string;
        like_count?: number;
        comments_count?: number;
        media_url?: string;
        thumbnail_url?: string;
        permalink?: string;
        insights?: { data?: { name: string; values?: { value: number }[] }[] };
      }[];
    }>(
      `${GRAPH}/${igUserId}/media?fields=id,caption,media_type,like_count,comments_count,media_url,thumbnail_url,permalink,insights.metric(reach)&limit=25&access_token=${token}`,
    );
    out.topPosts = (media.data ?? [])
      .map((p) => ({
        id: p.id,
        caption: (p.caption || "").slice(0, 90),
        thumb: p.thumbnail_url || p.media_url || null,
        permalink: p.permalink || "",
        platform: "instagram" as const,
        mediaType: p.media_type || "IMAGE",
        interactions: (p.like_count || 0) + (p.comments_count || 0),
        reach: p.insights?.data?.[0]?.values?.[0]?.value ?? 0,
      }))
      .sort((a, b) => b.interactions - a.interactions)
      .slice(0, 8);
  } catch {}

  out.prev.followersStart = out.followers - out.followerGrowth;
  out.engagementRate = out.reach > 0 ? (out.interactions / out.reach) * 100 : 0;
  out.delta = {
    reach: pct(out.reach, out.prev.reach),
    views: pct(out.views, out.prev.views),
    interactions: pct(out.interactions, out.prev.interactions),
    followers: out.prev.followersStart > 0 ? Math.round((out.followerGrowth / out.prev.followersStart) * 100) : null,
  };
  return out;
}

export async function getFacebookInsights(
  pageId: string,
  token: string,
  days: number,
): Promise<AccountInsights> {
  const out = empty();
  out.networks = ["facebook"];
  const { since, until } = range(days);

  try {
    const prof = await gget<{ fan_count?: number; followers_count?: number }>(
      `${GRAPH}/${pageId}?fields=fan_count,followers_count&access_token=${token}`,
    );
    out.followers = prof.followers_count ?? prof.fan_count ?? 0;
  } catch {}

  try {
    const metrics = "page_impressions_unique,page_post_engagements,page_fan_adds";
    const ts = await gget<TimeSeriesResp>(
      `${GRAPH}/${pageId}/insights?metric=${metrics}&period=day&since=${since}&until=${until}&access_token=${token}`,
    );
    const sum = (name: string) =>
      (ts.data?.find((d) => d.name === name)?.values ?? []).reduce((a, v) => a + (v.value || 0), 0);
    out.reach = sum("page_impressions_unique");
    out.views = out.reach;
    out.interactions = sum("page_post_engagements");
    out.followerGrowth = sum("page_fan_adds");
    out.trend = (ts.data?.find((d) => d.name === "page_impressions_unique")?.values ?? []).map((v) => ({
      date: v.end_time.slice(0, 10),
      value: v.value,
    }));
  } catch {}

  try {
    const posts = await gget<{
      data?: {
        id: string;
        message?: string;
        permalink_url?: string;
        full_picture?: string;
        insights?: { data?: { name: string; values?: { value: number }[] }[] };
      }[];
    }>(
      `${GRAPH}/${pageId}/posts?fields=id,message,permalink_url,full_picture,insights.metric(post_impressions_unique,post_clicks)&limit=15&access_token=${token}`,
    );
    out.topPosts = (posts.data ?? [])
      .map((p) => {
        const ins = p.insights?.data ?? [];
        const reach = ins.find((d) => d.name === "post_impressions_unique")?.values?.[0]?.value ?? 0;
        return {
          id: p.id,
          caption: (p.message || "").slice(0, 90),
          thumb: p.full_picture || null,
          permalink: p.permalink_url || "",
          platform: "facebook" as const,
          mediaType: "POST",
          interactions: 0,
          reach,
        };
      })
      .sort((a, b) => b.reach - a.reach)
      .slice(0, 8);
  } catch {}

  out.engagementRate = out.reach > 0 ? (out.interactions / out.reach) * 100 : 0;
  return out;
}

export interface ClientAccount {
  platform: string;
  external_id: string;
  access_token: string;
}

/** Agrega o relatório de várias contas do cliente (rede = all | instagram | facebook). */
export async function getClientInsights(
  accounts: ClientAccount[],
  days: number,
  network: "all" | "instagram" | "facebook",
): Promise<AccountInsights> {
  const use = accounts.filter(
    (a) =>
      (a.platform === "instagram" || a.platform === "facebook") &&
      (network === "all" || a.platform === network),
  );

  const parts = await Promise.all(
    use.map((a) =>
      a.platform === "instagram"
        ? getInstagramInsights(a.external_id, a.access_token, days)
        : getFacebookInsights(a.external_id, a.access_token, days),
    ),
  );

  const out = empty();
  const trendMap = new Map<string, number>();
  for (const r of parts) {
    out.followers += r.followers;
    out.followerGrowth += r.followerGrowth;
    out.reach += r.reach;
    out.views += r.views;
    out.interactions += r.interactions;
    out.likes += r.likes;
    out.comments += r.comments;
    out.saves += r.saves;
    out.shares += r.shares;
    out.profileVisits += r.profileVisits;
    out.prev.reach += r.prev.reach;
    out.prev.views += r.prev.views;
    out.prev.interactions += r.prev.interactions;
    out.prev.followersStart += r.prev.followersStart;
    out.topPosts.push(...r.topPosts);
    for (const n of r.networks) if (!out.networks.includes(n)) out.networks.push(n);
    for (const t of r.trend) trendMap.set(t.date, (trendMap.get(t.date) || 0) + t.value);
  }

  out.trend = [...trendMap.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([date, value]) => ({ date, value }));
  out.topPosts.sort((a, b) => b.interactions + b.reach - (a.interactions + a.reach)).splice(8);
  out.engagementRate = out.reach > 0 ? (out.interactions / out.reach) * 100 : 0;
  out.delta = {
    reach: pct(out.reach, out.prev.reach),
    views: pct(out.views, out.prev.views),
    interactions: pct(out.interactions, out.prev.interactions),
    followers: out.prev.followersStart > 0 ? Math.round((out.followerGrowth / out.prev.followersStart) * 100) : null,
  };
  return out;
}
