/**
 * ADMINS do Studio — só eles recebem os alertas internos (posts atrasados,
 * posts do dia no calendário). Todo mundo continua usando o Studio normalmente;
 * o que muda é só quem vê esses popups de alerta.
 *
 * A lista vem da env ADMIN_EMAILS (e-mails separados por vírgula). Se não estiver
 * setada, cai na lista abaixo. Pra adicionar/remover admin: edite ADMIN_EMAILS
 * no painel da Vercel (ou esta lista).
 */
const FALLBACK_ADMINS = ["marketinglionstorm@gmail.com", "anunciomarkseg@gmail.com"];

export function adminEmails(): string[] {
  const env = process.env.ADMIN_EMAILS;
  const list = env ? env.split(",") : FALLBACK_ADMINS;
  return list.map((e) => e.trim().toLowerCase()).filter(Boolean);
}

export function isAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  return adminEmails().includes(email.toLowerCase());
}
