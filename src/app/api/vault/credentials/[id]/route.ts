import { NextResponse } from "next/server";
import { guardVault } from "@/lib/vault-guard";
import { getCredentialWithFolder, updateCredential, deleteCredential } from "@/lib/vault-db";
import { canAccessSensitivity } from "@/lib/vault";

export const dynamic = "force-dynamic";

/** Edita um acesso. Senha só é trocada se vier no corpo (undefined = mantém). */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await guardVault();
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status });
  const { id } = await params;

  const found = await getCredentialWithFolder(id);
  if (!found) return NextResponse.json({ error: "Acesso não encontrado." }, { status: 404 });
  if (!canAccessSensitivity(found.folder.sensitivity, g.viewer)) {
    return NextResponse.json({ error: "Sem acesso a esse item." }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    category?: string;
    label?: string;
    url?: string;
    username?: string;
    password?: string;
    extra?: string;
  };

  try {
    await updateCredential(id, body);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

/** Apaga um acesso. */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await guardVault();
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status });
  const { id } = await params;

  const found = await getCredentialWithFolder(id);
  if (!found) return NextResponse.json({ error: "Acesso não encontrado." }, { status: 404 });
  if (!canAccessSensitivity(found.folder.sensitivity, g.viewer)) {
    return NextResponse.json({ error: "Sem acesso a esse item." }, { status: 403 });
  }

  try {
    await deleteCredential(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
