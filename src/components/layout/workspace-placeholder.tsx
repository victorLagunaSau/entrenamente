import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export function WorkspacePlaceholder({
  icon: Icon,
  route,
  title,
  description,
  tone = "brand",
  className,
}: {
  icon: LucideIcon;
  route: string;
  title: string;
  description?: string;
  /** "energy" para vistas gamificadas (rachas, XP). */
  tone?: "brand" | "energy";
  className?: string;
}) {
  return (
    <section
      className={cn(
        "flex min-h-[320px] flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed border-border bg-card/40 p-8 text-center",
        className
      )}
    >
      <span
        className={cn(
          "grid size-14 place-items-center rounded-2xl",
          tone === "energy" ? "bg-energy/15 text-energy" : "bg-primary/15 text-brand-light"
        )}
      >
        <Icon className="size-7" />
      </span>
      <code className="rounded-full border border-secondary/30 bg-secondary/10 px-3 py-1 font-mono text-xs text-secondary">
        {route}
      </code>
      <h1 className="max-w-xl text-2xl font-bold text-balance md:text-3xl">{title}</h1>
      {description && (
        <p className="max-w-md text-sm text-muted-foreground text-pretty">{description}</p>
      )}
    </section>
  );
}
