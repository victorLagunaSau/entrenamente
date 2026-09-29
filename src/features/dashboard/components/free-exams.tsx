"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { BookOpenCheck, CalendarClock, CircleAlert, ClipboardList, Download, Gift, Loader2, Lock, Target, Timer } from "lucide-react";

import { Button } from "@/components/ui/button";
import { MateriaGroup, QuestionAccordion } from "@/features/exam/components/libre/exam-report";
import { formatClock, type ExamRecord } from "@/features/exam/lib/libre";
import { formatScore } from "@/features/exam/types";
import { cn } from "@/lib/utils";

import { getTutorExamRecord, type TutorExam, type TutorStudent } from "../services/tutor-service";

const dateFmt = new Intl.DateTimeFormat("es-MX", { dateStyle: "long", timeStyle: "short" });

const accuracyOf = (e: TutorExam) => {
  const total = e.materias.reduce((n, m) => n + m.total, 0);
  return total ? Math.round((100 * e.materias.reduce((n, m) => n + m.correctas, 0)) / total) : 0;
};

/**
 * Exámenes de prueba gratuita del estudiante (padre sin plan): un botón por prueba permitida; al elegir una se
 * ve su resumen final y la guía de estudio (lo que no contestó bien, con diagnóstico y solución).
 */
export function FreeExams({ student, exams }: { student: TutorStudent; exams: TutorExam[] }) {
  // Las pruebas numeradas; si no hay numeración (exámenes viejos), los primeros exámenes en orden.
  const numbered = exams.filter((e) => e.studentId === student.id && e.pruebaNumero !== null);
  const done = (numbered.length ? numbered : exams.filter((e) => e.studentId === student.id))
    .map((e, i) => ({ exam: e, n: e.pruebaNumero ?? i + 1 }))
    .sort((a, b) => a.n - b.n);
  const slots = Math.max(student.trial?.granted ?? 3, done.length ? done[done.length - 1].n : 0);
  // "Ver resultados" desde la ficha llega con ?examen=ID: abre esa prueba.
  const requested = Number(useSearchParams().get("examen"));
  const initial = done.find((d) => d.exam.id === requested)?.exam.id ?? done.at(-1)?.exam.id ?? null;
  const [selected, setSelected] = React.useState<number | null>(initial);
  const sectionRef = React.useRef<HTMLElement>(null);
  React.useEffect(() => {
    if (requested && initial === requested) sectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [requested, initial]);

  return (
    <section ref={sectionRef} aria-labelledby="free-exams-title" className="flex scroll-mt-20 flex-col gap-4 rounded-2xl border bg-card p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-gold/15 text-gold">
          <Gift className="size-5" aria-hidden />
        </span>
        <div className="min-w-0">
          <h2 id="free-exams-title" className="text-lg font-bold">
            Exámenes de prueba gratuita
          </h2>
          <p className="text-sm text-muted-foreground text-pretty">
            {done.length === 0
              ? `${student.alias} aún no presenta su primera prueba. Aquí verás el resumen y su guía de estudio.`
              : `Elige una prueba para ver cómo le fue y qué preguntas debe repasar ${student.alias}.`}
          </p>
        </div>
      </div>

      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: slots }, (_, i) => {
          const item = done.find((d) => d.n === i + 1);
          if (!item) {
            return (
              <li key={i} className="flex flex-col gap-0.5 rounded-xl border border-dashed p-3 text-sm text-muted-foreground">
                <span className="font-semibold">Prueba {i + 1}</span>
                <span className="text-xs">Pendiente</span>
              </li>
            );
          }
          const active = selected === item.exam.id;
          return (
            <li key={i}>
              <button
                type="button"
                aria-pressed={active}
                onClick={() => setSelected(item.exam.id)}
                className={cn(
                  "flex w-full flex-col gap-0.5 rounded-xl border p-3 text-left text-sm transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
                  active ? "border-secondary/60 bg-secondary/10" : "hover:bg-accent"
                )}
              >
                <span className="flex items-center justify-between gap-2 font-semibold">
                  Prueba {item.n}
                  <span className="text-base font-bold tabular-nums">{accuracyOf(item.exam)}%</span>
                </span>
                <span className="text-xs text-muted-foreground">
                  {new Date(item.exam.completedAt).toLocaleDateString("es-MX", { day: "numeric", month: "short" })} ·{" "}
                  {item.exam.universityKey}
                </span>
                <span className="text-xs text-cool tabular-nums">
                  {item.exam.totalQuestions} preguntas ·{" "}
                  {item.exam.materias.reduce((n, m) => n + m.total - m.correctas, 0)} mal contestadas
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {selected !== null && <ExamSummary key={selected} examId={selected} />}
    </section>
  );
}

/** Resumen final de un examen congelado + guía de estudio (fallas). Descargar: no disponible sin plan (`demo`). */
export function ExamSummary({ examId, demo = true }: { examId: number; demo?: boolean }) {
  const [record, setRecord] = React.useState<ExamRecord | null | "error">(null);

  React.useEffect(() => {
    let active = true;
    getTutorExamRecord(examId)
      .then((r) => active && setRecord(r))
      .catch(() => active && setRecord("error"));
    return () => {
      active = false;
    };
  }, [examId]);

  if (record === "error") {
    return (
      <p role="alert" className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
        <CircleAlert className="size-4 shrink-0" /> No pudimos abrir este examen.
      </p>
    );
  }
  if (!record) {
    return (
      <div className="grid min-h-40 place-items-center" role="status" aria-label="Cargando examen">
        <Loader2 className="size-6 animate-spin text-brand-light motion-reduce:animate-none" />
      </div>
    );
  }

  const numbered = record.questions.map((q, i) => ({ q, n: i + 1 }));
  const fallas = numbered.filter(({ q }) => q.ponderacion_obtenida < 1);
  const aciertos = record.questions.length - fallas.length;
  const byMateria = new Map<string, typeof fallas>();
  fallas.forEach((f) => byMateria.set(f.q.materia, [...(byMateria.get(f.q.materia) ?? []), f]));
  const groups = [...byMateria.entries()].sort((a, b) => b[1].length - a[1].length);
  const pct = record.totalQuestions ? Math.round((100 * aciertos) / record.totalQuestions) : 0;

  return (
    <div className="flex flex-col gap-4 border-t pt-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
            Resumen final{record.pruebaNumero !== null && ` · Prueba gratuita ${record.pruebaNumero}`}
          </p>
          <h3 className="mt-1 text-xl font-bold text-balance">
            {record.universityKey} · {record.careerName}
          </h3>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
            <CalendarClock className="size-4" aria-hidden /> {dateFmt.format(new Date(record.completedAt))}
            {record.folio && <span className="font-mono text-xs">· {record.folio}</span>}
          </p>
        </div>
        <div className="text-right">
          <p className="font-display text-4xl font-bold tabular-nums">
            {formatScore(record.score)}
            <span className="text-lg font-medium text-muted-foreground"> / {formatScore(record.maxScore)}</span>
          </p>
          <p className="text-sm text-muted-foreground">Calificación</p>
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Stat icon={Target} label="Aciertos" value={`${aciertos} de ${record.totalQuestions} (${pct} %)`} />
        <Stat icon={ClipboardList} label="Respondidas" value={`${record.answeredQuestions} de ${record.totalQuestions}`} />
        <Stat icon={Timer} label="Tiempo usado" value={`${formatClock(record.timeSpentSeconds)} de ${formatClock(record.timeLimitSeconds)}`} />
      </dl>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[20rem] text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-muted-foreground">
              <th className="py-2 pr-3 font-medium">Materia</th>
              <th className="px-3 py-2 text-right font-medium">Aciertos</th>
              <th className="py-2 pl-3 text-right font-medium">%</th>
            </tr>
          </thead>
          <tbody>
            {record.materias.map((m) => (
              <tr key={m.materia_clave} className="border-b last:border-0">
                <td className="py-2 pr-3 font-medium">{m.materia}</td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {m.correctas}/{m.total}
                </td>
                <td className="py-2 pl-3 text-right font-semibold tabular-nums">{Math.round(m.porcentaje_aciertos)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h4 className="flex items-center gap-2 font-bold">
            <BookOpenCheck className="size-5 text-brand-light" aria-hidden /> Guía de estudio
            <span className="text-sm font-normal text-muted-foreground">
              {fallas.length === 0 ? "· ¡sin fallas!" : `· ${fallas.length} por repasar`}
            </span>
          </h4>
          {demo && (
            <Button variant="outline" size="sm" disabled title="Disponible con tu plan">
              <Download /> Descargar <span className="text-xs font-normal">(no disponible)</span> <Lock className="size-3.5" />
            </Button>
          )}
        </div>
        {groups.map(([materia, list]) => (
          <MateriaGroup key={materia} name={materia} count={list.length} summary={`${list.length} por repasar`}>
            {list.map(({ q, n }) => (
              <QuestionAccordion key={q.id_original} q={q} n={n} total={record.totalQuestions} />
            ))}
          </MateriaGroup>
        ))}
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: typeof Target; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2.5 rounded-lg bg-muted/50 px-3 py-2">
      <Icon className="size-4 shrink-0 text-brand-light" aria-hidden />
      <div className="min-w-0">
        <dt className="text-xs text-muted-foreground">{label}</dt>
        <dd className="truncate text-sm font-medium tabular-nums">{value}</dd>
      </div>
    </div>
  );
}
