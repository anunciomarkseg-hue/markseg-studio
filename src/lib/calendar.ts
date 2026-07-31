import { getSupabaseAdmin } from "./supabase";

/**
 * Calendário Editorial VISUAL — ferramenta separada do fluxo de aprovação.
 *
 * Propósito distinto: o time sobe UMA pauta em PDF por cliente e ela vira um
 * calendário editorial bonito, só pra VISUALIZAR e COMPARTILHAR com o cliente
 * (link público read-only). Não tem produção/aprovação post a post — isso é o
 * `editorial_posts`/`/pauta`. Aqui é vitrine do planejamento do mês.
 *
 * Tabelas: `editorial_calendars` (uma por PDF/mês) + `editorial_calendar_posts`.
 */

/** Status de publicação de cada post no calendário visual.
 *  "atrasado" NÃO é gravado — é derivado (pendente + data vencida). */
export type CalendarPostStatus = "pendente" | "publicado" | "erro";

export interface CalendarPost {
  id: string;
  calendar_id: string;
  ref: string;
  planned_date: string; // ISO
  format: string; // feed | carrossel | reel | story
  title: string;
  brief: string;
  networks: string[];
  status: CalendarPostStatus;
  sort: number;
}

export interface EditorialCalendar {
  id: string;
  group_key: string; // cliente
  title: string; // ex: "Agosto 2026"
  theme: string; // tema do mês (opcional)
  ref_year: number | null;
  ref_month: number | null; // 1-12
  source_name: string | null; // nome do PDF de origem
  token: string; // link público /cal/[token]
  created_at: string;
}

/** Calendário + seus posts (visão completa). */
export interface CalendarWithPosts extends EditorialCalendar {
  posts: CalendarPost[];
}

const CAL_COLS =
  "id, group_key, title, theme, ref_year, ref_month, source_name, token, created_at";
const POST_COLS =
  "id, calendar_id, ref, planned_date, format, title, brief, networks, status, sort";

export interface NewCalendarPost {
  ref: string;
  planned_date: string;
  format: string;
  title: string;
  brief: string;
  networks: string[];
}

/** Cria um calendário (com token público) e insere seus posts de uma vez. */
export async function createCalendar(
  input: {
    group_key: string;
    title: string;
    theme?: string;
    ref_year?: number | null;
    ref_month?: number | null;
    source_name?: string | null;
  },
  posts: NewCalendarPost[],
): Promise<{ id: string; token: string }> {
  const sb = getSupabaseAdmin();
  const token = crypto.randomUUID().replace(/-/g, "").slice(0, 16);

  const { data: cal, error } = await sb
    .from("editorial_calendars")
    .insert({
      group_key: input.group_key,
      title: input.title,
      theme: input.theme ?? "",
      ref_year: input.ref_year ?? null,
      ref_month: input.ref_month ?? null,
      source_name: input.source_name ?? null,
      token,
    })
    .select("id, token")
    .single();
  if (error) throw new Error(error.message);

  const calendarId = cal.id as string;
  if (posts.length) {
    const rows = posts.map((p, i) => ({
      calendar_id: calendarId,
      ref: p.ref,
      planned_date: p.planned_date,
      format: p.format,
      title: p.title,
      brief: p.brief,
      networks: p.networks,
      sort: i,
    }));
    const { error: pErr } = await sb.from("editorial_calendar_posts").insert(rows);
    if (pErr) throw new Error(pErr.message);
  }

  return { id: calendarId, token: cal.token as string };
}

/** Todos os calendários de um cliente (mais novos primeiro). */
export async function listCalendars(groupKey: string): Promise<EditorialCalendar[]> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("editorial_calendars")
    .select(CAL_COLS)
    .eq("group_key", groupKey)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as EditorialCalendar[];
}

/** Calendários de um cliente já com os posts embutidos (poucos por cliente). */
export async function listCalendarsWithPosts(groupKey: string): Promise<CalendarWithPosts[]> {
  const cals = await listCalendars(groupKey);
  if (!cals.length) return [];
  const sb = getSupabaseAdmin();
  const { data } = await sb
    .from("editorial_calendar_posts")
    .select(POST_COLS)
    .in(
      "calendar_id",
      cals.map((c) => c.id),
    )
    .order("planned_date", { ascending: true });
  const posts = (data ?? []) as CalendarPost[];
  const byCal: Record<string, CalendarPost[]> = {};
  for (const p of posts) (byCal[p.calendar_id] ??= []).push(p);
  return cals.map((c) => ({ ...c, posts: byCal[c.id] ?? [] }));
}

/** Contagem de posts por calendário (pra mostrar "12 posts" no card). */
export async function countPostsByCalendar(calendarIds: string[]): Promise<Record<string, number>> {
  if (!calendarIds.length) return {};
  const sb = getSupabaseAdmin();
  const { data } = await sb
    .from("editorial_calendar_posts")
    .select("calendar_id")
    .in("calendar_id", calendarIds);
  const out: Record<string, number> = {};
  for (const r of data ?? []) out[r.calendar_id as string] = (out[r.calendar_id as string] ?? 0) + 1;
  return out;
}

async function loadPosts(calendarId: string): Promise<CalendarPost[]> {
  const sb = getSupabaseAdmin();
  const { data } = await sb
    .from("editorial_calendar_posts")
    .select(POST_COLS)
    .eq("calendar_id", calendarId)
    .order("planned_date", { ascending: true });
  return (data ?? []) as CalendarPost[];
}

/** Um calendário + posts pelo id (uso interno). */
export async function getCalendar(id: string): Promise<CalendarWithPosts | null> {
  const sb = getSupabaseAdmin();
  const { data } = await sb.from("editorial_calendars").select(CAL_COLS).eq("id", id).maybeSingle();
  if (!data) return null;
  const posts = await loadPosts(id);
  return { ...(data as EditorialCalendar), posts };
}

/** Um calendário + posts pelo TOKEN público (página /cal/[token]). */
export async function getCalendarByToken(token: string): Promise<CalendarWithPosts | null> {
  const sb = getSupabaseAdmin();
  const { data } = await sb
    .from("editorial_calendars")
    .select(CAL_COLS)
    .eq("token", token)
    .maybeSingle();
  if (!data) return null;
  const posts = await loadPosts((data as EditorialCalendar).id);
  return { ...(data as EditorialCalendar), posts };
}

export async function updateCalendar(
  id: string,
  patch: Partial<Pick<EditorialCalendar, "title" | "theme">>,
): Promise<void> {
  const sb = getSupabaseAdmin();
  const { error } = await sb
    .from("editorial_calendars")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

/** Marca o status de publicação de um post do calendário (manual). */
export async function setCalendarPostStatus(
  postId: string,
  status: CalendarPostStatus,
): Promise<void> {
  const sb = getSupabaseAdmin();
  const { error } = await sb
    .from("editorial_calendar_posts")
    .update({ status })
    .eq("id", postId);
  if (error) throw new Error(error.message);
}

export async function deleteCalendar(id: string): Promise<void> {
  const sb = getSupabaseAdmin();
  // posts caem por ON DELETE CASCADE
  const { error } = await sb.from("editorial_calendars").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

/** Posts de HOJE (todos os clientes) — alimenta o alerta do Studio. */
export interface TodayPost {
  id: string;
  calendar_id: string;
  group_key: string;
  planned_date: string;
  format: string;
  title: string;
}

export async function listTodayPosts(): Promise<(TodayPost & { calendar_title: string })[]> {
  const sb = getSupabaseAdmin();
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();

  const { data } = await sb
    .from("editorial_calendar_posts")
    .select("id, calendar_id, planned_date, format, title")
    .gte("planned_date", start)
    .lt("planned_date", end)
    .order("planned_date", { ascending: true });

  const posts = (data ?? []) as Omit<TodayPost, "group_key">[];
  if (!posts.length) return [];

  const calIds = [...new Set(posts.map((p) => p.calendar_id))];
  const { data: cals } = await sb
    .from("editorial_calendars")
    .select("id, group_key, title")
    .in("id", calIds);
  const calMap = new Map(
    (cals ?? []).map((c) => [c.id as string, { group_key: c.group_key as string, title: c.title as string }]),
  );

  return posts.map((p) => {
    const c = calMap.get(p.calendar_id);
    return {
      ...p,
      group_key: c?.group_key ?? "",
      calendar_title: c?.title ?? "",
    };
  });
}
