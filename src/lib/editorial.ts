import { getSupabaseAdmin } from "./supabase";

export type ProductionStatus = "briefing" | "em_producao" | "pronto";
export type ApprovalStatus = "rascunho" | "enviado" | "aprovado" | "ajustes";

export interface EditorialPost {
  id: string;
  group_key: string;
  planned_date: string; // ISO
  networks: string[];
  format: string; // feed | carrossel | reel | story
  title: string; // tema curto do post (aparece no card)
  caption: string;
  brief: string;
  reference_urls: string[]; // mockups/referências (carrossel = várias; reel/story = vídeo)
  production_status: ProductionStatus;
  approval_status: ApprovalStatus;
  client_feedback: string | null;
  scheduled_post_id: string | null;
}

const COLS =
  "id, group_key, planned_date, networks, format, title, caption, brief, reference_urls, production_status, approval_status, client_feedback, scheduled_post_id";

export async function listEditorial(groupKey?: string | null): Promise<EditorialPost[]> {
  const sb = getSupabaseAdmin();
  let q = sb.from("editorial_posts").select(COLS).order("planned_date", { ascending: true });
  if (groupKey) q = q.eq("group_key", groupKey);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as EditorialPost[];
}

export interface EditorialInput {
  group_key: string;
  planned_date: string;
  networks: string[];
  format: string;
  title: string;
  caption: string;
  brief: string;
  reference_urls: string[];
  production_status: ProductionStatus;
}

export async function createEditorial(input: EditorialInput): Promise<string> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("editorial_posts")
    .insert({ ...input, approval_status: "rascunho" })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data.id as string;
}

export async function updateEditorial(
  id: string,
  patch: Partial<EditorialPost>,
): Promise<void> {
  const sb = getSupabaseAdmin();
  const { error } = await sb
    .from("editorial_posts")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteEditorial(id: string): Promise<void> {
  const sb = getSupabaseAdmin();
  const { error } = await sb.from("editorial_posts").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

/** Posts APROVADOS que ainda não viraram agendamento — alerta geral (todos os clientes). */
export async function listPendingScheduling(): Promise<EditorialPost[]> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("editorial_posts")
    .select(COLS)
    .eq("approval_status", "aprovado")
    .is("scheduled_post_id", null)
    .order("planned_date", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as EditorialPost[];
}

/** Cria (ou reaproveita) um link público de aprovação da pauta pro cliente. */
export async function createEditorialShare(groupKey: string): Promise<string> {
  const sb = getSupabaseAdmin();
  const { data: existing } = await sb
    .from("editorial_shares")
    .select("token")
    .eq("group_key", groupKey)
    .limit(1)
    .maybeSingle();
  if (existing?.token) return existing.token as string;

  const token = crypto.randomUUID().replace(/-/g, "").slice(0, 16);
  const { error } = await sb.from("editorial_shares").insert({ token, group_key: groupKey });
  if (error) throw new Error(error.message);
  return token;
}

export async function getEditorialShare(token: string): Promise<{ group_key: string } | null> {
  const sb = getSupabaseAdmin();
  const { data } = await sb
    .from("editorial_shares")
    .select("group_key")
    .eq("token", token)
    .maybeSingle();
  return data ? { group_key: data.group_key as string } : null;
}

export interface EditorialFeedback {
  id: string;
  post_id: string;
  author: string | null;
  message: string;
  action: string; // ajustes | aprovado
  created_at: string;
}

export async function addFeedback(
  postId: string,
  author: string | null,
  message: string,
  action: "ajustes" | "aprovado",
): Promise<void> {
  const sb = getSupabaseAdmin();
  const { error } = await sb
    .from("editorial_feedback")
    .insert({ post_id: postId, author, message, action });
  if (error) throw new Error(error.message);
}

export async function listFeedbackForPost(postId: string): Promise<EditorialFeedback[]> {
  const sb = getSupabaseAdmin();
  const { data } = await sb
    .from("editorial_feedback")
    .select("id, post_id, author, message, action, created_at")
    .eq("post_id", postId)
    .order("created_at", { ascending: true });
  return (data ?? []) as EditorialFeedback[];
}

/** Feedbacks de todos os posts de um cliente → mapa post_id -> lista. */
export async function listFeedbackForGroup(groupKey: string): Promise<Record<string, EditorialFeedback[]>> {
  const sb = getSupabaseAdmin();
  const { data: posts } = await sb.from("editorial_posts").select("id").eq("group_key", groupKey);
  const ids = (posts ?? []).map((p) => p.id);
  if (!ids.length) return {};
  const { data } = await sb
    .from("editorial_feedback")
    .select("id, post_id, author, message, action, created_at")
    .in("post_id", ids)
    .order("created_at", { ascending: true });
  const out: Record<string, EditorialFeedback[]> = {};
  for (const f of (data ?? []) as EditorialFeedback[]) (out[f.post_id] ??= []).push(f);
  return out;
}

/** Posts com ajuste pedido pelo cliente (todos os clientes) — alerta interno. */
export async function listPendingAjustes(): Promise<EditorialPost[]> {
  const sb = getSupabaseAdmin();
  const { data } = await sb
    .from("editorial_posts")
    .select(COLS)
    .eq("approval_status", "ajustes")
    .order("planned_date", { ascending: true });
  return (data ?? []) as EditorialPost[];
}

/** Tema do mês (por cliente + "YYYY-MM"). */
export async function getMonthTheme(groupKey: string, ym: string): Promise<string> {
  const sb = getSupabaseAdmin();
  const { data } = await sb
    .from("editorial_themes")
    .select("theme")
    .eq("group_key", groupKey)
    .eq("ym", ym)
    .maybeSingle();
  return (data?.theme as string) ?? "";
}

export async function getMonthThemes(groupKey: string): Promise<Record<string, string>> {
  const sb = getSupabaseAdmin();
  const { data } = await sb.from("editorial_themes").select("ym, theme").eq("group_key", groupKey);
  const out: Record<string, string> = {};
  for (const r of data ?? []) out[r.ym as string] = r.theme as string;
  return out;
}

export async function setMonthTheme(groupKey: string, ym: string, theme: string): Promise<void> {
  const sb = getSupabaseAdmin();
  const { error } = await sb
    .from("editorial_themes")
    .upsert({ group_key: groupKey, ym, theme }, { onConflict: "group_key,ym" });
  if (error) throw new Error(error.message);
}

/**
 * Só o NÚMERO de retornos do cliente que precisam de ação.
 *
 * O layout raiz roda em TODA navegação e antes buscava as duas listas inteiras
 * (com todas as colunas) só pra fazer .length — trabalho de sobra em cada
 * clique. Aqui pedimos ao banco apenas a contagem, e as duas em paralelo.
 */
export async function countPautaAlerts(): Promise<number> {
  const sb = getSupabaseAdmin();
  const [ajustes, aprovados] = await Promise.all([
    sb
      .from("editorial_posts")
      .select("id", { count: "exact", head: true })
      .eq("approval_status", "ajustes"),
    sb
      .from("editorial_posts")
      .select("id", { count: "exact", head: true })
      .eq("approval_status", "aprovado")
      .is("scheduled_post_id", null),
  ]);
  return (ajustes.count ?? 0) + (aprovados.count ?? 0);
}
