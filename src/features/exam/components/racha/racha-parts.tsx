"use client";

import type * as React from "react";
import { Flame } from "lucide-react";

import { cn } from "@/lib/utils";

import type { Nivel } from "../../lib/libre";
import { NIVEL_JUEGO, NIVEL_ORDEN } from "../../lib/racha";

/** Escalera de niveles: 3 escalones, el actual encendido. */
export function LevelLadder({ nivel, className }: { nivel: Nivel; className?: string }) {
  const paso = NIVEL_JUEGO[nivel].paso;
  return (
    <ol className={cn("flex items-end gap-1.5", className)} aria-label={`Nivel ${NIVEL_JUEGO[nivel].nombre}`}>
      {NIVEL_ORDEN.map((n, i) => {
        const on = i + 1 <= paso;
        const current = n === nivel;
        return (
          <li key={n} className="flex flex-1 flex-col items-center gap-1">
            <span
              className={cn(
                "w-full rounded-md transition-colors",
                i === 0 ? "h-3" : i === 1 ? "h-5" : "h-7",
                on ? "bg-energy" : "bg-muted",
                current && "shadow-glow-energy"
              )}
            />
            <span className={cn("text-[10px] font-semibold tracking-wide uppercase", current ? "text-energy" : "text-muted-foreground")}>
              {NIVEL_JUEGO[n].nombre}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/** Fuego con los días seguidos de racha. */
export function StreakBadge({ days, className }: { days: number; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border border-energy/40 bg-energy/10 px-3 py-1 text-sm font-bold text-energy", className)}>
      <Flame className="size-4 fill-energy/50" aria-hidden />
      <span className="tabular-nums">{days}</span>
      <span className="font-medium">{days === 1 ? "día" : "días"}</span>
    </span>
  );
}

/** Vibración corta del teléfono (si el navegador la soporta). */
export function buzz(pattern: number | number[]) {
  try {
    navigator.vibrate?.(pattern);
  } catch {}
}

/** Columna de teléfono: a pantalla completa en el celular, centrada en la web. */
export function PhoneFrame({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className="min-h-dvh bg-surface-deep">
      <div className={cn("relative mx-auto min-h-dvh w-full max-w-md overflow-hidden bg-background md:border-x", className)}>{children}</div>
    </div>
  );
}
