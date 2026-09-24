import type { Metadata, Viewport } from "next";
import { Inter, Poppins } from "next/font/google";

import { DevToolbar } from "@/components/layout/dev-toolbar";
import { BRAND, brandIcons } from "@/lib/brand";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

export const metadata: Metadata = {
  title: { default: BRAND.name, template: `%s · ${BRAND.name}` },
  description: BRAND.tagline,
  icons: brandIcons("estudiante"),
};

export const viewport: Viewport = {
  themeColor: BRAND.background,
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" className="dark">
      <body className={`${inter.variable} ${poppins.variable}`}>
        {children}
        <DevToolbar />
      </body>
    </html>
  );
}
