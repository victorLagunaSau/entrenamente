import Link from "next/link";
import { Brain } from "lucide-react";

import { cn } from "@/lib/utils";

// Isotipo provisional: se reemplazará por los archivos finales del logo (SVG).
export function Logo({
  className,
  href = "/",
  tagline = false,
}: {
  className?: string;
  href?: string;
  tagline?: boolean;
}) {
  return (
    <Link href={href} className={cn("flex items-center gap-2.5", className)}>
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand-gradient text-white shadow-glow-secondary">
        <Brain className="size-5" />
      </span>
      <span className="flex flex-col leading-none">
        <span className="font-display text-xl font-bold">
          Entrena<span className="text-brand-light">Mente</span>
        </span>
        {tagline && (
          <span className="mt-1 text-[9px] font-medium tracking-[0.18em] text-muted-foreground uppercase">
            Simuladores de examen de admisión
          </span>
        )}
      </span>
    </Link>
  );
}
