"use client";

import { useIdentidad } from "@/features/identidad";
import { cn } from "@/lib/utils";

const SIZES = {
  sm: "h-8 min-w-11 rounded-lg px-2 text-xs",
  md: "h-11 min-w-14 rounded-xl px-2.5 text-sm",
  lg: "h-14 min-w-18 rounded-2xl px-3 text-lg",
} as const;

/**
 * Sigla de una institución sobre su color institucional (identidad en Supabase, ver IdentidadProvider).
 * `id` puede ser el id o la clave; si la institución tiene sigla registrada, esa reemplaza a `label`.
 * Sin identidad, usa el marino de marca.
 */
export function UniversityBadge({
  id,
  label,
  size = "md",
  className,
}: {
  id: string;
  label: string;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const identidad = useIdentidad(id);
  const key = identidad?.id ?? id;
  return (
    <span
      className={cn(
        "inline-grid shrink-0 place-items-center font-display font-bold tracking-tight shadow-sm ring-1 ring-white/10",
        SIZES[size],
        className
      )}
      style={{ backgroundColor: `var(--uni-${key}, var(--muted))`, color: `var(--uni-${key}-fg, #ffffff)` }}
    >
      {identidad?.sigla ?? label}
    </span>
  );
}
