import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  env: {
    // Carimbo do deploy — assado no bundle do cliente no build e devolvido pelo
    // /api/version em runtime. Igual pro mesmo deploy, diferente quando sai um novo.
    // É o que faz o app instalado (PWA) se auto-atualizar sozinho.
    NEXT_PUBLIC_BUILD_STAMP: process.env.VERCEL_URL ?? "",
  },
};

export default nextConfig;
