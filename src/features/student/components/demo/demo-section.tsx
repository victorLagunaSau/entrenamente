import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/** Módulo del Home Demo: título con ícono (y extra a la derecha) sobre su contenido. */
export function DemoSection({
  id,
  icon: Icon,
  tone,
  title,
  subtitle,
  aside,
  children,
}: {
  id: string;
  icon: LucideIcon;
  tone: "brand" | "secondary" | "energy";
  title: string;
  subtitle?: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  const iconTone = {
    brand: "bg-primary/15 text-brand-light",
    secondary: "bg-secondary/15 text-secondary",
    energy: "bg-energy/15 text-energy",
  }[tone];

  return (
    <section id={id} aria-labelledby={`${id}-title`} className="flex scroll-mt-20 flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h2 id={`${id}-title`} className="flex min-w-0 items-center gap-2.5 text-lg font-bold">
            <span className={cn("grid size-8 shrink-0 place-items-center rounded-lg", iconTone)}>
              <Icon className="size-4" aria-hidden />
            </span>
            {title}
          </h2>
          {subtitle && <p className="text-sm text-muted-foreground text-pretty">{subtitle}</p>}
        </div>
        {aside}
      </div>
      {children}
    </section>
  );
}
