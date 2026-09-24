"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Wrench } from "lucide-react";

import { DEV_ROUTES } from "@/lib/routes";
import { cn } from "@/lib/utils";

/** Barra temporal para auditar diseño y responsive. Eliminar antes de producción. */
export function DevToolbar() {
  const pathname = usePathname();
  const current = pathname.replace(/\/$/, "") || "/";

  return (
    <nav
      aria-label="Navegación de desarrollo"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-secondary/30 bg-[#0B0C12]/95 backdrop-blur"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="flex h-[var(--devbar-h)] items-center gap-2 overflow-x-auto px-3 scrollbar-none">
        <span className="flex shrink-0 items-center gap-1 font-mono text-[10px] font-semibold tracking-widest text-secondary uppercase">
          <Wrench className="size-3" /> Dev
        </span>
        {DEV_ROUTES.map((r) => {
          const active = current === r.href;
          return (
            <Link
              key={r.href}
              href={r.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "shrink-0 rounded-md border px-2.5 py-1 font-mono text-xs transition-colors",
                active
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-cool hover:border-secondary hover:text-secondary"
              )}
            >
              [ {r.label} ]
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
