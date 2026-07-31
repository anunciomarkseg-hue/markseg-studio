import { getSupabaseAdmin } from "./supabase";

export interface MuralRead {
  reader_id: string;
  reader_name: string | null;
  reader_role: string | null;
  created_at: string;
}

export interface MuralMessage {
  id: string;
  title: string | null;
  author: string | null;
  message: string;
  color: number; // índice da cor do card (0-5)
  pinned: boolean;
  urgent: boolean;
  created_at: string;
  reads: MuralRead[]; // quem confirmou leitura
}

const COLS = "id, title, author, message, color, pinned, urgent, created_at";

/** Anexa as confirmações de leitura (reads) a cada mensagem. */
async function withReads(rows: Omit<MuralMessage, "reads">[]): Promise<MuralMessage[]> {
  const ids = rows.map((r) => r.id);
  const byMsg: Record<string, MuralRead[]> = {};
  if (ids.length) {
    const sb = getSupabaseAdmin();
    const { data: reads } = await sb
      .from("mural_reads")
      .select("message_id, reader_id, reader_name, reader_role, created_at")
      .in("message_id", ids)
      .order("created_at", { ascending: true });
    for (const r of (reads ?? []) as (MuralRead & { message_id: string })[]) {
      (byMsg[r.message_id] ??= []).push({
        reader_id: r.reader_id,
        reader_name: r.reader_name,
        reader_role: r.reader_role,
        created_at: r.created_at,
      });
    }
  }
  return rows.map((r) => ({ ...r, reads: byMsg[r.id] ?? [] }));
}

export async function listMural(): Promise<MuralMessage[]> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("mural_messages")
    .select(COLS)
    .order("pinned", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);
  return withReads((data ?? []) as Omit<MuralMessage, "reads">[]);
}

export async function createMural(input: {
  title: string | null;
  author: string | null;
  message: string;
  color: number;
  urgent?: boolean;
  pinned?: boolean;
}): Promise<MuralMessage> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("mural_messages")
    .insert({
      title: input.title?.slice(0, 120) || null,
      author: input.author,
      message: input.message.slice(0, 8000),
      color: ((input.color % 6) + 6) % 6,
      urgent: Boolean(input.urgent),
      pinned: Boolean(input.pinned),
    })
    .select(COLS)
    .single();
  if (error) throw new Error(error.message);
  return { ...(data as Omit<MuralMessage, "reads">), reads: [] };
}

/** Registra (ou mantém) a confirmação de leitura de uma pessoa e devolve a lista atualizada. */
export async function addMuralRead(
  messageId: string,
  reader: { readerId: string; name: string | null; role: string | null },
): Promise<MuralRead[]> {
  const sb = getSupabaseAdmin();
  const { error } = await sb.from("mural_reads").upsert(
    {
      message_id: messageId,
      reader_id: reader.readerId,
      reader_name: reader.name?.slice(0, 40) ?? null,
      reader_role: reader.role?.slice(0, 40) ?? null,
    },
    { onConflict: "message_id,reader_id" },
  );
  if (error) throw new Error(error.message);

  const { data } = await sb
    .from("mural_reads")
    .select("reader_id, reader_name, reader_role, created_at")
    .eq("message_id", messageId)
    .order("created_at", { ascending: true });
  return (data ?? []) as MuralRead[];
}

/** Recado urgente mais recente das últimas 24h (pro alerta em tela cheia). */
export async function latestUrgent(): Promise<MuralMessage | null> {
  const sb = getSupabaseAdmin();
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await sb
    .from("mural_messages")
    .select(COLS)
    .eq("urgent", true)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) throw new Error(error.message);
  if (!data?.length) return null;
  return { ...(data[0] as Omit<MuralMessage, "reads">), reads: [] };
}

export async function deleteMural(id: string): Promise<void> {
  const sb = getSupabaseAdmin();
  const { error } = await sb.from("mural_messages").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function setPinned(id: string, pinned: boolean): Promise<void> {
  const sb = getSupabaseAdmin();
  const { error } = await sb.from("mural_messages").update({ pinned }).eq("id", id);
  if (error) throw new Error(error.message);
}
