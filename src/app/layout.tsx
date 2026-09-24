import type { Metadata, Viewport } from "next";
import { Inter, Space_Grotesk } from "next/font/google";

import { DevToolbar } from "@/components/layout/dev-toolbar";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const spaceGrotesk = Space_Grotesk({ variable: "--font-space-grotesk", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "ExaMente",
  description: "Prepárate para tus exámenes con práctica gamificada.",
};

export const viewport: Viewport = {
  themeColor: "#12131C",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" className="dark">
      <body className={`${inter.variable} ${spaceGrotesk.variable}`}>
        {children}
        <DevToolbar />
      </body>
    </html>
  );
}
