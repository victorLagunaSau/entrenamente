import * as React from "react";

import { cn } from "@/lib/utils";

import { type ExamTarget, UNI_BAR } from "../../lib/libre";

/**
 * Mimetización visual: barra con el color institucional, siglas a modo de escudo,
 * nombre oficial y carrera. La usan el examen en curso y el visor histórico.
 */
export function UniBar({ target, children, className }: { target: ExamTarget; children?: React.ReactNode; className?: string }) {
  const { institucion, carrera } = target;
  return (
    <div className={cn("text-white", className)} style={{ backgroundColor: UNI_BAR }}>
      <div className="mx-auto flex w-full max-w-5xl items-center gap-3 px-4 py-2.5 md:px-8">
        <span
          className="grid h-10 min-w-12 shrink-0 place-items-center rounded-xl bg-white/15 px-2 font-display text-sm font-bold tracking-tight ring-1 ring-white/25"
          aria-hidden
        >
          {institucion.clave}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{institucion.nombre}</p>
          <p className="truncate text-xs text-white/80">
            {carrera.nombre}
            {carrera.area && <> · {carrera.area}</>}
          </p>
        </div>
        {children}
      </div>
    </div>
  );
}
