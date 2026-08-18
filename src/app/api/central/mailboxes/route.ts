import { NextResponse } from "next/server";
import { supabaseConfigured } from "@/lib/supabase";
import { currentAgent } from "@/lib/central/guard";
import { createMailbox, deleteMailbox, listMailboxesSafe } from "@/lib/central/db";

export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const int = (v: unknown, d: number) => (Number.isFinite(Number(v)) ? Number(v) : d);
const bool = (v: unknown, d: boolean) => (typeof v === "boolean" ? v : d);

/** Lista as caixas (SEM segredos). Só admin. */
export async function GET() {
  if (!supabaseConfigured) return NextResponse.json({ error: "Supabase não configurado" }, { status: 500 });
  if ((await currentAgent()).level !== "admin") {
    return NextResponse.json({ error: "Acesso restrito a administradores." }, { status: 403 });
  }
  try {
    return NextResponse.json({ mailboxes: await listMailboxesSafe() });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

/** Conecta uma nova caixa (IMAP + SMTP). Só admin. */
export async function POST(req: Request) {
  if (!supabaseConfigured) return NextResponse.json({ error: "Supabase não configurado" }, { status: 500 });
  if ((await currentAgent()).level !== "admin") {
    return NextResponse.json({ error: "Só administradores podem conectar caixas." }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const email = str(body.email).toLowerCase();
  const label = str(body.label) || email;
  const imap_host = str(body.imap_host);
  const smtp_host = str(body.smtp_host);
  const imap_user = str(body.imap_user) || email;
  const smtp_user = str(body.smtp_user) || email;
  const imap_pass = str(body.imap_pass);
  const smtp_pass = str(body.smtp_pass) || imap_pass;

  if (!EMAIL_RE.test(email)) return NextResponse.json({ error: "E-mail inválido." }, { status: 400 });
  if (!imap_host || !imap_pass) {
    return NextResponse.json({ error: "Informe o servidor IMAP e a senha." }, { status: 400 });
  }
  if (!smtp_host) return NextResponse.json({ error: "Informe o servidor SMTP." }, { status: 400 });

  try {
    const id = await createMailbox({
      label,
      email,
      color: str(body.color) || "gradient-blue",
      imap_host,
      imap_port: int(body.imap_port, 993),
      imap_user,
      imap_pass,
      imap_tls: bool(body.imap_tls, true),
      smtp_host,
      smtp_port: int(body.smtp_port, 465),
      smtp_user,
      smtp_pass,
      smtp_secure: bool(body.smtp_secure, true),
      active: true,
    });
    return NextResponse.json({ ok: true, id });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

/** Remove uma caixa. Só admin. */
export async function DELETE(req: Request) {
  if (!supabaseConfigured) return NextResponse.json({ error: "Supabase não configurado" }, { status: 500 });
  if ((await currentAgent()).level !== "admin") {
    return NextResponse.json({ error: "Só administradores podem remover caixas." }, { status: 403 });
  }
  const id = new URL(req.url).searchParams.get("id") ?? "";
  if (!id) return NextResponse.json({ error: "Caixa não informada." }, { status: 400 });
  try {
    await deleteMailbox(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
