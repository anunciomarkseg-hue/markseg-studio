import type { Metadata, Viewport } from "next";
import { Titillium_Web, Inter } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/Sidebar";
import { Topbar } from "@/components/Topbar";
import { AppShell } from "@/components/AppShell";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { listPendingAjustes, listPendingScheduling } from "@/lib/editorial";
import { isAdminEmail } from "@/lib/admins";

const titillium = Titillium_Web({
  subsets: ["latin"],
  weight: ["300", "400", "600", "700", "900"],
  variable: "--font-titillium",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://studio.markseg.com.br"),
  title: "MarkSeg Studio — Publicações",
  description: "Plataforma interna de agendamento e publicação nas redes sociais — MarkSeg.",
  openGraph: {
    title: "MarkSeg Studio",
    description: "Agende e publique nas redes sociais — ferramenta interna da MarkSeg.",
    url: "https://studio.markseg.com.br",
    siteName: "MarkSeg Studio",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#1c6fce",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Retornos do cliente que precisam de ação (ajustes pedidos + aprovados p/ agendar).
  // Só admins veem o contador de alerta (igual aos popups).
  let pautaAlerts = 0;
  if (user && isAdminEmail(user.email)) {
    try {
      const [aj, pend] = await Promise.all([listPendingAjustes(), listPendingScheduling()]);
      pautaAlerts = aj.length + pend.length;
    } catch {
      /* banco indisponível — sem badge */
    }
  }

  return (
    <html lang="pt-BR" className={`${titillium.variable} ${inter.variable}`}>
      <body className="font-sans">
        <AppShell
          sidebar={<Sidebar userEmail={user?.email ?? null} pautaAlerts={pautaAlerts} />}
          topbar={<Topbar userEmail={user?.email ?? null} pautaAlerts={pautaAlerts} />}
        >
          {children}
        </AppShell>
      </body>
    </html>
  );
}
