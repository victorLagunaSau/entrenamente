"use client";

import * as React from "react";
import { createPortal } from "react-dom";

import { BRAND, LOGOS } from "@/lib/brand";

import { EXAM_TYPE_LABEL, EXAM_TYPES, formatHours, type TutorStats } from "../lib/tutor-stats";
import { TUTOR_COPY } from "../lib/tutor-plans";
import type { TutorExam } from "../services/tutor-service";
import type { SubjectInfo } from "./analytics-tab";
import { MateriaHeatmap, WeeklyScoreChart } from "./charts";
import { useTutor } from "./tutor-context";

const LEVEL: Record<TutorExam["level"], string> = { facil: "Fácil", media: "Media", dificil: "Difícil" };

const examAccuracy = (e: TutorExam) => {
  const total = e.materias.reduce((n, m) => n + m.total, 0);
  return total ? Math.round((100 * e.materias.reduce((n, m) => n + m.correctas, 0)) / total) : null;
};

const minutes = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

/**
 * Reporte ejecutivo para imprimir o "Guardar como PDF". Se monta en <body> solo mientras se imprime;
 * el CSS de impresión (globals.css) oculta todo lo demás. Conserva los colores de la marca al imprimir.
 */
export function TutorReport({ info, stats, exams }: { info: SubjectInfo; stats: TutorStats; exams: TutorExam[] }) {
  const { kind } = useTutor();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  const names = new Map(info.students.map((s) => [s.id, s.alias]));
  const today = new Date().toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" });
  const logo = LOGOS.maestro.full;

  return createPortal(
    <div id="tutor-report" className="hidden bg-background text-foreground print:block">
      <header className="flex items-center justify-between gap-6 border-b pb-4">
        {/* eslint-disable-next-line @next/next/no-img-element -- impresión: sin optimización de next/image */}
        <img src={logo.src} alt={BRAND.name} className="h-12 w-auto" />
        <div className="text-right">
          <p className="text-xs text-muted-foreground">{TUTOR_COPY[kind].title}</p>
          <p className="text-xs text-muted-foreground">Generado el {today}</p>
        </div>
      </header>

      <section className="mt-5">
        <p className="text-xs font-semibold tracking-wide text-secondary uppercase">Reporte de rendimiento</p>
        <h1 className="font-display text-2xl font-bold">{info.label}</h1>
        {!info.single && (
          <p className="text-sm text-muted-foreground">
            {info.students.length} estudiantes: {info.students.map((s) => s.alias).join(", ")}
          </p>
        )}
      </section>

      <section className="mt-5 grid grid-cols-4 gap-3">
        <Stat label="Promedio global de aciertos" value={`${stats.accuracy ?? 0}%`} />
        <Stat label="Exámenes realizados" value={String(stats.exams)} />
        <Stat label="Horas de práctica" value={formatHours(stats.hours)} />
        <Stat label="Exámenes esta semana" value={String(stats.examsThisWeek)} />
      </section>

      <section className="mt-3 grid grid-cols-3 gap-3">
        {stats.byMode.map((m) => (
          <Stat
            key={m.type}
            label={`${EXAM_TYPES.find((t) => t.id === m.type)!.label} · ${m.exams} ${m.exams === 1 ? "examen" : "exámenes"}`}
            value={m.accuracy === null ? "—" : `${m.accuracy}%`}
          />
        ))}
      </section>

      {(stats.strongest || stats.weakest) && (
        <p className="mt-4 text-sm text-cool">
          {stats.strongest && (
            <>
              Materia más fuerte: <strong className="text-foreground">{stats.strongest.materia}</strong> ({stats.strongest.overall}%).{" "}
            </>
          )}
          {stats.weakest && (
            <>
              Materia a reforzar: <strong className="text-foreground">{stats.weakest.materia}</strong> ({stats.weakest.overall}%).
            </>
          )}
        </p>
      )}

      <section className="mt-5 break-inside-avoid rounded-xl border bg-card p-4">
        <h2 className="font-bold">Evolución semanal</h2>
        <p className="mb-2 text-xs text-muted-foreground">% de aciertos por semana · últimas 12 semanas</p>
        <WeeklyScoreChart weeks={stats.weeks} interactive={false} />
      </section>

      <section className="mt-5 break-inside-avoid rounded-xl border bg-card p-4">
        <h2 className="mb-2 font-bold">Mapa de calor por materias</h2>
        <MateriaHeatmap rows={stats.materias} />
      </section>

      <section className="mt-5">
        <h2 className="mb-2 font-bold">Desglose de exámenes</h2>
        <table className="w-full text-xs">
          <thead className="text-left text-muted-foreground">
            <tr className="border-b">
              <th className="py-1.5 pr-2 font-medium">Folio</th>
              <th className="px-2 py-1.5 font-medium">Fecha</th>
              {!info.single && <th className="px-2 py-1.5 font-medium">Estudiante</th>}
              <th className="px-2 py-1.5 font-medium">Modalidad</th>
              <th className="px-2 py-1.5 font-medium">Carrera</th>
              <th className="px-2 py-1.5 font-medium">Nivel</th>
              <th className="px-2 py-1.5 text-right font-medium">Aciertos</th>
              <th className="px-2 py-1.5 text-right font-medium">Puntos</th>
              <th className="py-1.5 pl-2 text-right font-medium">Tiempo</th>
            </tr>
          </thead>
          <tbody>
            {[...exams].reverse().map((e) => {
              const acc = examAccuracy(e);
              return (
                <tr key={e.id} className="border-b break-inside-avoid">
                  <td className="py-1.5 pr-2 font-mono">{e.folio}</td>
                  <td className="px-2 py-1.5 whitespace-nowrap">
                    {new Date(e.completedAt).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "2-digit" })}
                  </td>
                  {!info.single && <td className="px-2 py-1.5">{names.get(e.studentId) ?? "—"}</td>}
                  <td className="px-2 py-1.5">{EXAM_TYPE_LABEL[e.type]}</td>
                  <td className="px-2 py-1.5">
                    {e.universityKey} · {e.careerName}
                  </td>
                  <td className="px-2 py-1.5">{LEVEL[e.level]}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{acc === null ? "—" : `${acc}%`}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">
                    {e.score.toLocaleString("es-MX", { maximumFractionDigits: 2 })}/{e.maxScore.toLocaleString("es-MX")}
                  </td>
                  <td className="py-1.5 pl-2 text-right tabular-nums">{minutes(e.timeSpentSeconds)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <footer className="mt-6 border-t pt-3 text-center text-[10px] text-muted-foreground">
        {BRAND.name} · {BRAND.tagline} · Los exámenes están congelados: reflejan las preguntas tal como se respondieron.
      </footer>
    </div>,
    document.body
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-card p-3">
      <p className="text-xl font-bold tabular-nums">{value}</p>
      <p className="text-[11px] text-muted-foreground">{label}</p>
    </div>
  );
}
