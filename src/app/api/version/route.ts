import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Marca da versão em produção (id único do deploy na Vercel).
 *  O app instalado compara com a versão que carregou e, se mudou, recarrega sozinho. */
export async function GET() {
  return NextResponse.json(
    { v: process.env.VERCEL_URL ?? "dev" },
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}
