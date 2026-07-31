import webpush from "web-push";
import { getSupabaseAdmin } from "./supabase";

export const pushConfigured = () =>
  Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);

let ready = false;
function ensure() {
  if (ready) return;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:contato@markseg.com.br",
    process.env.VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  );
  ready = true;
}

export interface PushSubInput {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

/** Salva (ou atualiza) a inscrição de avisos de um aparelho. */
export async function savePushSub(sub: PushSubInput, clientId: string | null, name: string | null) {
  const sb = getSupabaseAdmin();
  const { error } = await sb.from("push_subs").upsert(
    {
      endpoint: sub.endpoint,
      p256dh: sub.keys.p256dh,
      auth: sub.keys.auth,
      client_id: clientId,
      name: name?.slice(0, 40) ?? null,
    },
    { onConflict: "endpoint" },
  );
  if (error) throw new Error(error.message);
}

export async function deletePushSub(endpoint: string) {
  const sb = getSupabaseAdmin();
  await sb.from("push_subs").delete().eq("endpoint", endpoint);
}

/** Dispara um aviso pra todo mundo inscrito, menos pra quem gerou o evento. */
export async function sendPush(
  payload: {
    title: string;
    body: string;
    url?: string;
    tag?: string;
    urgent?: boolean;
    requireInteraction?: boolean;
  },
  exceptClientId?: string | null,
) {
  if (!pushConfigured()) return;
  ensure();
  const sb = getSupabaseAdmin();
  const { data: subs } = await sb.from("push_subs").select("id, endpoint, p256dh, auth, client_id");
  if (!subs?.length) return;

  const body = JSON.stringify(payload);
  await Promise.allSettled(
    subs
      .filter((s) => !exceptClientId || s.client_id !== exceptClientId)
      .map(async (s) => {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            body,
          );
        } catch (e) {
          // 404/410 = inscrição morta: limpa do banco
          const code = (e as { statusCode?: number }).statusCode;
          if (code === 404 || code === 410) await sb.from("push_subs").delete().eq("id", s.id);
        }
      }),
  );
}
