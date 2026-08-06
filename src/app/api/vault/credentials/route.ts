import { NextResponse } from "next/server";
import { guardVault } from "@/lib/vault-guard";
import { getFolder, listCredentials, createCredential } from "@/lib/vault-db";
import { canAccessSensitivity } from "@/lib/vault";

export const dynamic = "force-dynamic";

/** Lista os acessos de uma pasta (SEM as senhas — só metadados). */
export async function GET(req: Request) {
  const g = await guardVault();
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status });

  const folderId = new URL(req.url).searchParams.get("folder") ?? "";
  if (!folderId) return NextResponse.json({ error: "Pasta não informada." }, { status: 400 });

  const folder = await getFolder(folderId);
  if (!folder) return NextResponse.json({ error: "Pasta não encontrada." }, { status: 404 });
  if (!canAccessSensitivity(folder.sensitivity, g.viewer)) {
    return NextResponse.json({ error: "Sem acesso a essa pasta." }, { status: 403 });
  }

  try {
    const credentials = await listCredentials(folderId);
    return NextResponse.json({ credentials });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

/** Cria um acesso dentro de uma pasta. */
export async function POST(req: Request) {
  const g = await guardVault();
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status });

  const body = (await req.json().catch(() => ({}))) as {
    folderId?: string;
    category?: string;
    label?: string;
    url?: string;
    username?: string;
    password?: string;
    extra?: string;
  };

  const folderId = (body.folderId ?? "").trim();
  const label = (body.label ?? "").trim();
  if (!folderId) return NextResponse.json({ error: "Pasta não informada." }, { status: 400 });
  if (!label) return NextResponse.json({ error: "Dê um nome pro acesso (ex.: Gmail)." }, { status: 400 });

  const folder = await getFolder(folderId);
  if (!folder) return NextResponse.json({ error: "Pasta não encontrada." }, { status: 404 });
  if (!canAccessSensitivity(folder.sensitivity, g.viewer)) {
    return NextResponse.json({ error: "Sem acesso a essa pasta." }, { status: 403 });
  }

  try {
    const id = await createCredential({
      folderId,
      category: body.category ?? "outros",
      label,
      url: body.url,
      username: body.username,
      password: body.password,
      extra: body.extra,
    });
    return NextResponse.json({ ok: true, id }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
