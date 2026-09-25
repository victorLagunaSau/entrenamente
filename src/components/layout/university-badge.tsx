import { cn } from "@/lib/utils";

/** Instituciones con color oficial en globals.css (`--uni-*`). */
export type UniversityColorId = "unam" | "ipn" | "poli" | "uam" | "uvm" | "tec" | "udg";

const SIZES = {
  sm: "h-8 min-w-11 rounded-lg px-2 text-xs",
  md: "h-11 min-w-14 rounded-xl px-2.5 text-sm",
  lg: "h-14 min-w-18 rounded-2xl px-3 text-lg",
} as const;

/**
 * Siglas de una universidad sobre su color institucional (texto blanco).
 * Si no hay color registrado para `id`, usa el marino de marca.
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
  return (
    <span
      className={cn(
        "inline-grid shrink-0 place-items-center font-display font-bold tracking-tight text-white shadow-sm ring-1 ring-white/10",
        SIZES[size],
        className
      )}
      style={{ backgroundColor: `var(--uni-${id}, var(--muted))` }}
    >
      {label}
    </span>
  );
}
