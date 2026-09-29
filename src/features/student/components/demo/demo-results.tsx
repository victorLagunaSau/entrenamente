"use client";

import { BookOpenCheck, ChartColumn, ClipboardCheck, Sigma, Trophy } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { MateriaGroup, QuestionAccordion } from "@/features/exam/components/libre/exam-report";
import type { SnapshotQuestion } from "@/features/exam/lib/libre";
import { cn } from "@/lib/utils";

import type { FreeExam } from "../../services/demo-service";
import { DemoSection } from "./demo-section";

const pctFmt = new Intl.NumberFormat("es-MX", { maximumFractionDigits: 1 });

/** Tras el primer examen: calificación más alta y promedio de las pruebas gratis. */
export function DemoStats({ exams, total }: { exams: FreeExam[]; total: number }) {
  const scores = exams.map((e) => e.score);
  const best = Math.max(...scores);
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;

  return (
    <DemoSection id="metricas" icon={ChartColumn} tone="secondary" title="Tus métricas">
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Tile icon={Trophy} label="Calificación más alta" value={`${pctFmt.format(best)} %`} highlight />
        <Tile icon={Sigma} label="Calificación promedio" value={`${pctFmt.format(avg)} %`} />
        <Tile icon={ClipboardCheck} label="Exámenes gratis" value={`${exams.length} de ${total}`} className="col-span-2 sm:col-span-1" />
      </dl>
    </DemoSection>
  );
}

function Tile({
  icon: Icon,
  label,
  value,
  highlight = false,
  className,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  highlight?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1 rounded-2xl border bg-card p-4", className)}>
      <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="size-3.5" aria-hidden /> {label}
      </dt>
      <dd className={cn("font-display text-2xl font-bold tabular-nums sm:text-3xl", highlight && "text-secondary")}>{value}</dd>
    </div>
  );
}

type Falla = { q: SnapshotQuestion; n: number; exam: number; total: number };

/**
 * Guía de errores: solo lo que contestó mal en sus pruebas gratis, por materia (la más débil
 * primero), con el diagnóstico de su error y la solución paso a paso.
 */
export function DemoGuide({ exams }: { exams: FreeExam[] }) {
  const byMateria = new Map<string, Falla[]>();
  exams.forEach((e) =>
    e.questions.forEach((q, i) => {
      if (q.ponderacion_obtenida >= 1) return;
      byMateria.set(q.materia, [...(byMateria.get(q.materia) ?? []), { q, n: i + 1, exam: e.numero, total: e.totalQuestions }]);
    })
  );
  const groups = [...byMateria.entries()].sort((a, b) => b[1].length - a[1].length);
  const count = groups.reduce((n, [, list]) => n + list.length, 0);

  return (
    <DemoSection
      id="guia"
      icon={BookOpenCheck}
      tone="brand"
      title="Guía de errores"
      subtitle={
        count === 0
          ? "¡Sin fallas en tus exámenes gratis! Respondiste todo correctamente."
          : `${count} ${count === 1 ? "pregunta" : "preguntas"} por repasar: por qué estuvo mal y cómo resolverla paso a paso.`
      }
    >
      {groups.map(([materia, list]) => (
        <MateriaGroup key={materia} name={materia} count={list.length} summary={`${list.length} por repasar`}>
          {list.map(({ q, n, exam, total }) => (
            <QuestionAccordion key={`${exam}-${q.id_original}`} q={q} n={n} total={total} source={`Prueba gratuita ${exam}`} />
          ))}
        </MateriaGroup>
      ))}
    </DemoSection>
  );
}

/** Antes del primer examen: el lugar donde aparecerán sus métricas y su guía. */
export function DemoGuidePlaceholder() {
  return (
    <DemoSection id="guia" icon={BookOpenCheck} tone="brand" title="Métricas y guía de errores">
      <p className="rounded-2xl border border-dashed p-5 text-sm text-muted-foreground text-pretty">
        Al terminar tu Examen 1 verás aquí tu calificación más alta, tu promedio y la guía con cada pregunta que falles: por qué estuvo mal y
        la solución paso a paso.
      </p>
    </DemoSection>
  );
}
