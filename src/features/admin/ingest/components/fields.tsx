"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";

import type { Dificultad } from "@/features/exam/types";
import { invalidClass } from "@/features/registro/components/form-field";
import { cn } from "@/lib/utils";

import { dificultadOf, findInstitucion } from "../lib/catalog";
import { useCatalogo } from "../lib/use-catalogo";

const controlBase =
  "border-input w-full min-w-0 rounded-md border bg-background/60 text-base text-foreground transition-[color,box-shadow] outline-none md:text-sm focus-visible:border-ring focus-visible:ring-ring/40 focus-visible:ring-[3px] disabled:opacity-50";

export function NativeSelect({ className, children, ...props }: React.ComponentProps<"select">) {
  return (
    <div className="relative">
      <select className={cn(controlBase, invalidClass, "h-11 appearance-none pr-9 pl-3", className)} {...props}>
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground" />
    </div>
  );
}

export function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      className={cn(controlBase, invalidClass, "min-h-20 px-3 py-2.5 placeholder:text-muted-foreground", className)}
      {...props}
    />
  );
}

export function DifficultyBadge({ value }: { value: Dificultad }) {
  const d = dificultadOf(value);
  return (
    <span className={cn("inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold whitespace-nowrap", d?.tone)}>
      {d?.nombre ?? value}
    </span>
  );
}

/** Punto con el color institucional (si la institución tiene uno). */
export function InstitucionDot({ clave }: { clave: string }) {
  const { catalogo } = useCatalogo();
  const color = catalogo ? findInstitucion(catalogo, clave)?.colorPrimario : null;
  return (
    <span
      className="size-2.5 shrink-0 rounded-full ring-1 ring-white/20"
      style={{ backgroundColor: color ?? "var(--muted-foreground)" }}
    />
  );
}

/** Chip de filtro con conteo; `aria-pressed` refleja si está activo. */
export function FilterChip({
  active,
  count,
  onClick,
  children,
}: {
  active: boolean;
  count?: number;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "inline-flex h-9 shrink-0 items-center gap-2 rounded-full border px-3 text-sm font-medium transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
        active ? "border-secondary bg-secondary/15 text-foreground" : "bg-background/40 text-cool hover:bg-accent"
      )}
    >
      {children}
      {count !== undefined && (
        <span
          className={cn(
            "rounded-full px-1.5 font-mono text-[11px] tabular-nums",
            active ? "bg-secondary text-secondary-foreground" : "bg-muted text-muted-foreground"
          )}
        >
          {count}
        </span>
      )}
    </button>
  );
}
