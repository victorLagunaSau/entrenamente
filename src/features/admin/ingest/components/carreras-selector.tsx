"use client";

import * as React from "react";
import Link from "next/link";
import { Check, Minus } from "lucide-react";

import { carrerasPorArea } from "@/features/escuelas/lib/catalogo";
import type { Institucion } from "@/features/escuelas/types";
import { cn } from "@/lib/utils";

import { findInstitucion } from "../lib/catalog";
import { InstitucionDot, NativeSelect } from "./fields";

/**
 * Asignación Universidad › Área › Carreras (catálogo de /admin/escuelas).
 * Marcar un área marca todas sus carreras; una guía puede cubrir varias áreas y carreras.
 * Con `onInstitucionChange` muestra el select de institución; si no, usa la que recibe.
 */
export function CarrerasSelector({
  id,
  catalogo,
  institucion,
  onInstitucionChange,
  value,
  onChange,
  invalid,
}: {
  id?: string;
  catalogo: Institucion[];
  /** Clave de la institución (UNAM, TEC…). */
  institucion: string | null;
  onInstitucionChange?: (clave: string | null) => void;
  value: string[];
  onChange: (carreras: string[]) => void;
  invalid?: boolean;
}) {
  const inst = institucion ? findInstitucion(catalogo, institucion) : null;
  const selected = new Set(value);
  const groups = inst ? carrerasPorArea(inst) : [];
  const all = inst?.carreras.map((c) => c.id) ?? [];

  const toggle = (ids: string[], on: boolean) => {
    const next = new Set(selected);
    ids.forEach((c) => (on ? next.add(c) : next.delete(c)));
    // Solo carreras de la institución actual.
    onChange([...next].filter((c) => all.includes(c)));
  };
  const stateOf = (ids: string[]) => {
    const n = ids.filter((c) => selected.has(c)).length;
    return n === 0 ? "off" : n === ids.length ? "on" : "mixed";
  };

  return (
    <div id={id} className={cn("flex flex-col gap-3 rounded-xl border p-3", invalid && "border-destructive")}>
      {onInstitucionChange && (
        <div className="flex flex-col gap-2 sm:max-w-md">
          <label htmlFor={`${id ?? "carreras"}-institucion`} className="text-sm font-medium text-cool">
            Universidad o examen
          </label>
          <NativeSelect
            id={`${id ?? "carreras"}-institucion`}
            value={institucion ?? ""}
            onChange={(e) => {
              onInstitucionChange(e.target.value || null);
              onChange([]);
            }}
          >
            <option value="" disabled>
              Elige…
            </option>
            {catalogo.map((i) => (
              <option key={i.id} value={i.clave}>
                {i.clave} · {i.nombre}
              </option>
            ))}
          </NativeSelect>
        </div>
      )}

      {!inst ? (
        <p className="text-sm text-muted-foreground">
          {institucion ? `«${institucion}» no está en el catálogo o está desactivada.` : "Elige la universidad o examen para ver sus áreas y carreras."}
        </p>
      ) : all.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {inst.clave} no tiene carreras.{" "}
          <Link href="/admin/escuelas" className="text-brand-light underline-offset-4 hover:underline">
            Agrégalas en Escuelas y carreras
          </Link>
          .
        </p>
      ) : (
        <>
          <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold">
            <Box state={stateOf(all)} />
            <input type="checkbox" className="sr-only" checked={stateOf(all) === "on"} onChange={() => toggle(all, stateOf(all) !== "on")} />
            <InstitucionDot clave={inst.clave} />
            Todas las carreras de {inst.clave}
            <span className="ml-auto font-mono text-xs font-normal text-muted-foreground">
              {all.filter((c) => selected.has(c)).length}/{all.length}
            </span>
          </label>

          {groups.map(({ area, carreras }) => {
            const ids = carreras.map((c) => c.id);
            const state = stateOf(ids);
            return (
              <fieldset key={area?.id ?? "sin-area"} className="flex flex-col gap-2 rounded-lg bg-background/40 p-3">
                <legend className="sr-only">{area ? `Área ${area.codigo}` : "Sin área"}</legend>
                <label className="flex cursor-pointer items-start gap-2 text-sm font-semibold">
                  <Box state={state} />
                  <input type="checkbox" className="sr-only" checked={state === "on"} onChange={() => toggle(ids, state !== "on")} />
                  <span className="min-w-0">
                    {area ? (
                      <>
                        <span className="font-mono text-gold">{area.codigo}</span> · {area.nombre}
                      </>
                    ) : (
                      "Sin área"
                    )}
                  </span>
                  <span className="ml-auto shrink-0 font-mono text-xs font-normal text-muted-foreground">
                    {ids.filter((c) => selected.has(c)).length}/{ids.length}
                  </span>
                </label>
                {carreras.length === 0 ? (
                  <p className="pl-6 text-xs text-muted-foreground">Área sin carreras.</p>
                ) : (
                  <div className="grid gap-1 pl-4 sm:grid-cols-2">
                    {carreras.map((c) => (
                      <label key={c.id} className="flex cursor-pointer items-start gap-2 rounded-md px-1 py-1 text-sm text-cool hover:bg-accent/50">
                        <Box state={selected.has(c.id) ? "on" : "off"} />
                        <input type="checkbox" className="sr-only" checked={selected.has(c.id)} onChange={(e) => toggle([c.id], e.target.checked)} />
                        <span className="min-w-0">{c.nombre}</span>
                      </label>
                    ))}
                  </div>
                )}
              </fieldset>
            );
          })}
        </>
      )}
    </div>
  );
}

function Box({ state }: { state: "on" | "off" | "mixed" }) {
  return (
    <span
      aria-hidden
      className={cn(
        "mt-px grid size-4 shrink-0 place-items-center rounded border transition-colors [label:has(:focus-visible)_&]:ring-[3px] [label:has(:focus-visible)_&]:ring-ring/50",
        state === "off" ? "border-muted-foreground/60" : "border-secondary bg-secondary text-secondary-foreground"
      )}
    >
      {state === "on" && <Check className="size-3" strokeWidth={3} />}
      {state === "mixed" && <Minus className="size-3" strokeWidth={3} />}
    </span>
  );
}
