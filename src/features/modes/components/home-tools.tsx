import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";

export type HomeTool = {
  label: string;
  description: string;
  icon: LucideIcon;
  /** Sin href = herramienta aún no disponible ("Próximamente"). */
  href?: string;
};

/** Botones de acceso a las herramientas de un home. `tone` energy para vistas gamificadas. */
export function HomeTools({ tools, tone = "brand" }: { tools: HomeTool[]; tone?: "brand" | "energy" | "gold" }) {
  const iconTone = {
    brand: "bg-primary/15 text-brand-light",
    energy: "bg-energy/15 text-energy",
    gold: "bg-gold/15 text-gold",
  }[tone];

  return (
    <ul className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
      {tools.map((tool) => {
        const body = (
          <>
            <span className={cn("grid size-12 place-items-center rounded-xl", iconTone)}>
              <tool.icon className="size-6" />
            </span>
            <span className="flex flex-col gap-1">
              <span className="flex items-center gap-1 font-semibold">
                {tool.label}
                {tool.href && <ChevronRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />}
              </span>
              <span className="text-xs text-muted-foreground text-pretty sm:text-sm">{tool.description}</span>
            </span>
            {!tool.href && (
              <span className="absolute top-3 right-3 rounded-full bg-muted px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
                Pronto
              </span>
            )}
          </>
        );
        const base = "group relative flex h-full flex-col gap-4 rounded-2xl border bg-card p-4 sm:p-5";

        return (
          <li key={tool.label}>
            {tool.href ? (
              <Link
                href={tool.href}
                className={cn(
                  base,
                  "transition-colors hover:border-brand-light/50 hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
                )}
              >
                {body}
              </Link>
            ) : (
              <div className={cn(base, "opacity-70")} aria-disabled>
                {body}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
