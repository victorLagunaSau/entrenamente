import type { Metadata, Viewport } from "next";
import { Inter, Poppins } from "next/font/google";

import { ServiceWorker } from "@/components/layout/service-worker";
import { IdentidadProvider } from "@/features/identidad";
import { BRAND, brandApp } from "@/lib/brand";
import { SITE_URL } from "@/lib/site";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: BRAND.name, template: `%s · ${BRAND.name}` },
  description: BRAND.tagline,
  // Vista previa al compartir el enlace (WhatsApp, redes): título y descripción de cada página.
  openGraph: { siteName: BRAND.name, locale: "es_MX", type: "website" },
  ...brandApp("estudiante"),
};

export const viewport: Viewport = {
  themeColor: BRAND.background,
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    // suppressHydrationWarning: el script de la landing marca <html> antes de que cargue React.
    <html lang="es" className="dark" suppressHydrationWarning>
      <body className={`${inter.variable} ${poppins.variable}`}>
        <IdentidadProvider>{children}</IdentidadProvider>
        <ServiceWorker />
      </body>
    </html>
  );
}
