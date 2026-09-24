import type { Metadata } from "next";
import { ShieldCheck } from "lucide-react";

import { Logo } from "@/components/layout/logo";

export const metadata: Metadata = { title: "Backoffice · ExaMente", robots: { index: false } };

/** Layout aislado del flujo de usuarios finales. */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[calc(100dvh-var(--devbar-h))] flex-col">
      <header className="border-b border-secondary/20 bg-[#0E0F16]">
        <div className="flex h-14 items-center justify-between px-4 md:px-8">
          <Logo href="/admin/ingest" className="text-lg" />
          <span className="flex items-center gap-1.5 rounded-full border border-secondary/30 bg-secondary/10 px-3 py-1 font-mono text-xs text-secondary">
            <ShieldCheck className="size-3.5" /> ADMIN
          </span>
        </div>
      </header>
      <main className="flex-1 p-4 md:p-8">{children}</main>
    </div>
  );
}
