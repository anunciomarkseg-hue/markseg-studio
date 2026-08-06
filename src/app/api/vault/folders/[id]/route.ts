import { NextResponse } from "next/server";
import { guardVault } from "@/lib/vault-guard";
import { getFolder, updateFolder, deleteFolder } from "@/lib/vault-db";
import { canAccessSensitivity, SENSITIVITIES, type Sensitivity } from "@/lib/vault";

export const dynamic = "force-dynamic";

/** Edita uma pasta (nome, sigilo, observações). */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await guardVault();
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status });
  const { id } = await params;

  const folder = await getFolder(id);
  if (!folder) return NextResponse.json({ error: "Pasta não encontrada." }, { status: 404 });
  // Só mexe em pasta que já pode ver.
  if (!canAccessSensitivity(folder.sensitivity, g.viewer)) {
    return NextResponse.json({ error: "Sem acesso a essa pasta." }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    name?: string;
    sensitivity?: string;
    notes?: string;
  };

  let sensitivity: Sensitivity | undefined;
  if (body.sensitivity !== undefined) {
    sensitivity = body.sensitivity as Sensitivity;
    if (!SENSITIVITIES.includes(sensitivity)) {
      return NextResponse.json({ error: "Nível de sigilo inválido." }, { status: 400 });
    }
    // Não pode "promover" a pasta pra um nível que ele mesmo não alcança.
    if (!canAccessSensitivity(sensitivity, g.viewer)) {
      return NextResponse.json(
        { error: "Você não pode mover a pasta pra esse nível de sigilo." },
        { status: 403 },
      );
    }
  }

  try {
    await updateFolder(id, {
      name: body.name,
      sensitivity,
      notes: body.notes,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

/** Apaga a pasta (e todos os acessos dentro, via ON DELETE CASCADE). */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await guardVault();
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status });
  const { id } = await params;

  const folder = await getFolder(id);
  if (!folder) return NextResponse.json({ error: "Pasta não encontrada." }, { status: 404 });
  if (!canAccessSensitivity(folder.sensitivity, g.viewer)) {
    return NextResponse.json({ error: "Sem acesso a essa pasta." }, { status: 403 });
  }

  try {
    await deleteFolder(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
