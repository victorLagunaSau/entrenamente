"use client";

import * as React from "react";
import { Check, GraduationCap } from "lucide-react";

import { UniversityBadge } from "@/components/layout/university-badge";
import { cn } from "@/lib/utils";

import type { Institucion } from "../types";

/**
 * Universidad → Carrera del catálogo oficial (solo activas). `taken` son las carreras que ya son metas:
 * se ven pero no se pueden elegir.
 */
export function CareerPicker({
  catalog,
  university: uni,
  career,
  taken,
  takenLabel,
  onUniversityChange,
  onCareerChange,
}: {
  catalog: Institucion[];
  university: string | null;
  career: string | null;
  taken: Set<string>;
  takenLabel: string;
  onUniversityChange: (id: string) => void;
  onCareerChange: (id: string) => void;
}) {
  const university = catalog.find((u) => u.id === uni) ?? null;

  return (
    <>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-semibold">Universidad</legend>
        <div className="flex flex-wrap gap-2">
          {catalog.map((u) => (
            <button
              key={u.id}
              type="button"
              aria-pressed={u.id === uni}
              aria-label={u.nombre}
              onClick={() => onUniversityChange(u.id)}
              className={cn(
                "rounded-xl p-1 ring-2 transition-all focus-visible:ring-ring/60 focus-visible:outline-none",
                u.id === uni ? "ring-secondary" : "ring-transparent opacity-70 hover:opacity-100"
              )}
            >
              <UniversityBadge id={u.id} label={u.clave} size="sm" />
            </button>
          ))}
        </div>
        {university && <p className="text-xs text-muted-foreground">{university.nombre}</p>}
      </fieldset>

      {university && (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-semibold">Carrera</legend>
          <ul className="flex max-h-60 flex-col gap-1.5 overflow-y-auto">
            {university.carreras
              .filter((c) => c.activo)
              .map((c) => {
                const already = taken.has(c.id);
                const active = career === c.id;
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      disabled={already}
                      aria-pressed={active}
                      onClick={() => onCareerChange(c.id)}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none disabled:opacity-50",
                        active ? "border-secondary/60 bg-secondary/10" : "hover:bg-accent"
                      )}
                    >
                      <GraduationCap className="size-4 shrink-0 text-brand-light" aria-hidden />
                      <span className="flex-1">{c.nombre}</span>
                      {already ? (
                        <span className="text-xs text-muted-foreground">{takenLabel}</span>
                      ) : (
                        active && <Check className="size-4 text-secondary" aria-hidden />
                      )}
                    </button>
                  </li>
                );
              })}
          </ul>
        </fieldset>
      )}
    </>
  );
}

/** Instituciones activas con al menos una carrera activa: lo que se puede elegir como meta. */
export const selectableCatalog = (catalog: Institucion[]) =>
  catalog.filter((i) => i.activo && i.carreras.some((c) => c.activo));
