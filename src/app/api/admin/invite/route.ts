import { NextResponse } from "next/server";
import { getSupabaseAdmin, supabaseConfigured } from "@/lib/supabase";
import { isAdminEmail } from "@/lib/admins";
import { isCurrentUserAdmin } from "@/lib/admin-guard";
import { accessLevelOf, type AccessLevel } from "@/lib/access";

export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function parseLevel(v: unknown, fallback: AccessLevel = "editor"): AccessLevel {
  return v === "admin" || v === "editor" || v === "viewer" ? v : fallback;
}

/** Base pública do app (pro link do e-mail apontar pro domínio certo). */
function siteOrigin(req: Request): string {
  const env = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  if (env) return env;
  return new URL(req.url).origin;
}

/** Lista quem já está na plataforma (só admin). */
export async function GET() {
  if (!supabaseConfigured) {
    return NextResponse.json({ error: "Supabase não configurado" }, { status: 500 });
  }
  if (!(await isCurrentUserAdmin())) {
    return NextResponse.json({ error: "Acesso restrito a administradores." }, { status: 403 });
  }
  try {
    const sb = getSupabaseAdmin();
    const { data, error } = await sb.auth.admin.listUsers({ perPage: 200 });
    if (error) throw error;
    const users = (data.users ?? [])
      .map((u) => ({
        id: u.id,
        email: u.email ?? "",
        name: (u.user_metadata?.full_name as string) ?? "",
        role: (u.user_metadata?.role as string) ?? "",
        level: accessLevelOf(u),
        // admin definido pela lista de e-mails é fixo (não dá pra rebaixar pela tela).
        fixedAdmin: isAdminEmail(u.email),
        confirmed: Boolean(u.email_confirmed_at ?? u.confirmed_at),
        lastSignIn: u.last_sign_in_at ?? null,
        createdAt: u.created_at ?? null,
      }))
      .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
    return NextResponse.json({ users });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

/** Convida uma pessoa por e-mail (só admin). */
export async function POST(req: Request) {
  if (!supabaseConfigured) {
    return NextResponse.json({ error: "Supabase não configurado" }, { status: 500 });
  }
  if (!(await isCurrentUserAdmin())) {
    return NextResponse.json({ error: "Só administradores podem convidar." }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 80) : "";
  const role = typeof body.role === "string" ? body.role.trim().slice(0, 40) : "";
  const access_level = parseLevel(body.access_level);
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "E-mail inválido." }, { status: 400 });
  }

  try {
    const sb = getSupabaseAdmin();
    const { error } = await sb.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${siteOrigin(req)}/definir-senha`,
      data: {
        full_name: name || undefined,
        role: role || undefined,
        access_level,
        invited_via: "studio",
      },
    });
    if (error) {
      const already = /already.*(registered|exists)|been registered|duplicate/i.test(error.message);
      return NextResponse.json(
        {
          error: already
            ? "Esse e-mail já tem cadastro. A pessoa já pode entrar em /login (ou usar 'esqueci a senha')."
            : error.message,
        },
        { status: 400 },
      );
    }
    return NextResponse.json({ ok: true, email });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

/** Altera o nível de acesso de uma pessoa (só admin). */
export async function PATCH(req: Request) {
  if (!supabaseConfigured) {
    return NextResponse.json({ error: "Supabase não configurado" }, { status: 500 });
  }
  if (!(await isCurrentUserAdmin())) {
    return NextResponse.json({ error: "Só administradores podem alterar níveis." }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const userId = typeof body.userId === "string" ? body.userId : "";
  const access_level = parseLevel(body.access_level);
  if (!userId) {
    return NextResponse.json({ error: "Usuário não informado." }, { status: 400 });
  }

  try {
    const sb = getSupabaseAdmin();
    const { data: got, error: gErr } = await sb.auth.admin.getUserById(userId);
    if (gErr || !got.user) throw gErr ?? new Error("Usuário não encontrado");
    if (isAdminEmail(got.user.email)) {
      return NextResponse.json(
        { error: "Esse usuário é admin fixo (pela lista de e-mails) e não pode ser rebaixado aqui." },
        { status: 400 },
      );
    }
    const meta = { ...(got.user.user_metadata ?? {}), access_level };
    const { error } = await sb.auth.admin.updateUserById(userId, { user_metadata: meta });
    if (error) throw error;
    return NextResponse.json({ ok: true, access_level });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
