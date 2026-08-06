import { NextResponse } from "next/server";
import { guardVault } from "@/lib/vault-guard";
import { listFolders, createFolder } from "@/lib/vault-db";
import {
  canAccessSensitivity,
  SENSITIVITIES,
  type Sensitivity,
  type VaultScope,
} from "@/lib/vault";

export const dynamic = "force-dynamic";

/** Lista as pastas que o usuário PODE ver (filtradas pelo sigilo). */
export async function GET() {
  const g = await guardVault();
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status });
  try {
    const all = await listFolders();
    const folders = all.filter((f) => canAccessSensitivity(f.sensitivity, g.viewer));
    return NextResponse.json({ folders });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

/** Cria uma pasta. Só dá pra criar num sigilo que o próprio usuário alcança. */
export async function POST(req: Request) {
  const g = await guardVault();
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status });

  const body = (await req.json().catch(() => ({}))) as {
    scope?: string;
    name?: string;
    sensitivity?: string;
    notes?: string;
  };
  const name = (body.name ?? "").trim();
  if (!name) return NextResponse.json({ error: "Dê um nome pra pasta." }, { status: 400 });

  const scope: VaultScope = body.scope === "interno" ? "interno" : "cliente";
  const sensitivity = (body.sensitivity ?? "equipe") as Sensitivity;
  if (!SENSITIVITIES.includes(sensitivity)) {
    return NextResponse.json({ error: "Nível de sigilo inválido." }, { status: 400 });
  }
  if (!canAccessSensitivity(sensitivity, g.viewer)) {
    return NextResponse.json(
      { error: "Você não pode criar uma pasta nesse nível de sigilo." },
      { status: 403 },
    );
  }

  try {
    const id = await createFolder({ scope, name, sensitivity, notes: body.notes });
    return NextResponse.json({ ok: true, id }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
