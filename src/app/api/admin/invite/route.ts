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
    // O link tem que passar pelo /auth/confirm (cria a sessão) ANTES de cair na
    // tela de criar senha — senão a pessoa não consegue definir a senha.
    const options = {
      // Manda direto pra tela de senha (client), que lê o token do link e cria a
      // sessão. Assim funciona com o e-mail PADRÃO do Supabase (sem SMTP/template).
      redirectTo: `${siteOrigin(req)}/definir-senha`,
      data: {
        full_name: name || undefined,
        role: role || undefined,
        access_level,
        invited_via: "studio",
      },
    };

    let { error } = await sb.auth.admin.inviteUserByEmail(email, options);

    // Já existe? Se for convite PENDENTE (nunca confirmou), reenvia; se já é ativo, avisa.
    if (error && /already|registered|exists|duplicate/i.test(error.message)) {
      const existing = await findUserByEmail(sb, email);
      if (existing && existing.confirmed) {
        return NextResponse.json(
          { error: "Esse e-mail já tem cadastro ativo. A pessoa entra em /login (ou usa 'esqueci a senha')." },
          { status: 400 },
        );
      }
      if (existing) {
        // apaga o convite pendente e manda um novo (link fresco)
        await sb.auth.admin.deleteUser(existing.id);
        ({ error } = await sb.auth.admin.inviteUserByEmail(email, options));
      }
    }

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ ok: true, email });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

/** Acha um usuário pelo e-mail (varre a lista do Admin). */
async function findUserByEmail(
  sb: ReturnType<typeof getSupabaseAdmin>,
  email: string,
): Promise<{ id: string; confirmed: boolean } | null> {
  const { data } = await sb.auth.admin.listUsers({ perPage: 200 });
  const u = (data?.users ?? []).find((x) => (x.email ?? "").toLowerCase() === email);
  if (!u) return null;
  return { id: u.id, confirmed: Boolean(u.email_confirmed_at ?? u.confirmed_at) };
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
