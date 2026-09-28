"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, ChevronRight, FlaskConical } from "lucide-react";

import { getCatalogo } from "@/features/escuelas/services/catalogo-service";
import { getStudentSummary } from "@/features/student/services/student-service";
import type { Dificultad } from "@/features/exam/types";

import { type ExamTarget, MOCK_LIMIT, NIVELES, type Nivel, volumenDe } from "../../lib/libre";
import { getDisponibles } from "../../services/libre-service";
import { UniBar } from "./uni-bar";

export type ResolvedTarget =
  | { status: "ok"; target: ExamTarget; conteo: Record<Dificultad, number> }
  | { status: "sin-meta" }
  | { status: "sin-preguntas"; target: ExamTarget | null };

/**
 * Institución y carrera llegan preseleccionadas desde fuera: `?carrera=<id>` o, si no viene,
 * la meta inicial del alumno. Aquí solo se elige la dificultad.
 */
export async function resolveTarget(carreraParam: string | null): Promise<ResolvedTarget> {
  const [catalogo, disponibles, summary] = await Promise.all([
    getCatalogo(),
    getDisponibles(),
    carreraParam ? Promise.resolve(null) : getStudentSummary(),
  ]);
  const carreraId = carreraParam ?? summary?.goal?.careerId ?? null;
  if (!carreraId) return { status: "sin-meta" };

  const inst = catalogo.find((i) => i.carreras.some((c) => c.id === carreraId));
  const carrera = inst?.carreras.find((c) => c.id === carreraId);
  if (!inst || !carrera) return { status: "sin-preguntas", target: null };

  const target: ExamTarget = {
    institucion: { id: inst.id, clave: inst.clave, nombre: inst.nombre, colorId: inst.colorId },
    carrera: { id: carrera.id, nombre: carrera.nombre, area: inst.areas.find((a) => a.id === carrera.areaId)?.nombre ?? null },
  };
  const conteo = disponibles.get(carrera.id);
  if (!conteo || conteo.facil + conteo.media + conteo.dificil === 0) return { status: "sin-preguntas", target };
  return { status: "ok", target, conteo };
}

/** Único paso previo: elegir la dificultad. Al tocar un nivel se pasa directo a las indicaciones. */
export function ExamLevelPicker({
  target,
  conteo,
  onPick,
}: {
  target: ExamTarget;
  conteo: Record<Dificultad, number>;
  onPick: (nivel: Nivel) => void;
}) {
  const total = conteo.facil + conteo.media + conteo.dificil;

  return (
    <div className="flex min-h-dvh flex-col">
      <UniBar target={target} />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 p-4 md:p-8">
        <Link href="/app/student" className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> Mi home
        </Link>
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold sm:text-3xl">Examen libre</h1>
          <p className="text-sm text-muted-foreground text-pretty">
            {target.institucion.clave} · {target.carrera.nombre}. Elige la dificultad para comenzar.
          </p>
          {MOCK_LIMIT && (
            <span className="inline-flex w-fit items-center gap-1.5 rounded-full border px-3 py-1 font-mono text-xs text-muted-foreground">
              <FlaskConical className="size-3.5" /> Modo prueba: {MOCK_LIMIT[0]}–{MOCK_LIMIT[1]} preguntas
            </span>
          )}
        </div>

        <div role="list" aria-label="Nivel de dificultad" className="grid gap-3 sm:grid-cols-3">
          {NIVELES.map((n) => {
            const [min, max] = n.volumen;
            return (
              <button
                key={n.value}
                type="button"
                role="listitem"
                onClick={() => onPick(n.value)}
                className="group flex flex-col gap-1.5 rounded-2xl border bg-card p-5 text-left shadow-sm transition-colors outline-none hover:border-foreground/40 focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                <span className="flex items-center justify-between font-display text-lg font-semibold text-primary">
                  {n.nombre}
                  <ChevronRight className="size-5 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </span>
                <span className="font-mono text-xs text-cool">
                  {min}–{max} preguntas
                </span>
                <span className="text-xs text-muted-foreground text-pretty">{n.detalle}</span>
                <span className="mt-1 text-xs text-muted-foreground">{conteo[n.value]} de este nivel en el banco</span>
              </button>
            );
          })}
        </div>

        {total < volumenDe("facil")[0] && (
          <p className="text-xs text-muted-foreground">Por ahora hay {total} preguntas para esta carrera: tu examen será más corto.</p>
        )}
      </main>
    </div>
  );
}
