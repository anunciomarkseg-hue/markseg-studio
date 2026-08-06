import { NextResponse } from "next/server";
import { guardVault } from "@/lib/vault-guard";
import { getCredentialWithFolder, logAccess } from "@/lib/vault-db";
import { decrypt } from "@/lib/vault-crypto";
import { canAccessSensitivity } from "@/lib/vault";

export const dynamic = "force-dynamic";

/**
 * Revela a senha (e o "extra"/2FA) de UM acesso. Revalida o sigilo na hora,
 * decifra no servidor e registra na auditoria quem viu o quê.
 * Usa POST (não GET) pra a senha nunca cair em log de URL/histórico.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await guardVault();
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status });
  const { id } = await params;

  const found = await getCredentialWithFolder(id);
  if (!found) return NextResponse.json({ error: "Acesso não encontrado." }, { status: 404 });
  if (!canAccessSensitivity(found.folder.sensitivity, g.viewer)) {
    return NextResponse.json({ error: "Seu nível não revela essa senha." }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as { action?: "reveal" | "copy" };

  try {
    const password = decrypt(found.cred.password_enc);
    const extra = decrypt(found.cred.extra_enc);
    await logAccess({
      credentialId: found.cred.id,
      credentialLabel: found.cred.label,
      folderName: found.folder.name,
      userEmail: g.viewer.email,
      action: body.action === "copy" ? "copy" : "reveal",
    });
    return NextResponse.json({ password, extra });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
