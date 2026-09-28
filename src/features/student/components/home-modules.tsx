"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  BookOpen,
  CalendarCheck,
  ChevronRight,
  Flame,
  History,
  Library,
  NotebookPen,
  Plus,
  TrendingDown,
  TrendingUp,
} from "lucide-react";

import { UniversityBadge } from "@/components/layout/university-badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import type { HomeCareer, PastExam } from "../services/student-home-mock";

/** Estructura común: título del módulo (con acción opcional a la derecha) y una ficha por carrera. */
function HomeModule({
  id,
  title,
  icon: Icon,
  tone,
  action,
  children,
}: {
  id: string;
  title: string;
  icon: LucideIcon;
  tone: "brand" | "secondary" | "energy";
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  const iconTone = {
    brand: "bg-primary/15 text-brand-light",
    secondary: "bg-secondary/15 text-secondary",
    energy: "bg-energy/15 text-energy",
  }[tone];

  return (
    <section id={id} aria-labelledby={`${id}-title`} className="flex scroll-mt-20 flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 id={`${id}-title`} className="flex min-w-0 items-center gap-2.5 text-lg font-bold whitespace-nowrap">
          <span className={cn("grid size-8 place-items-center rounded-lg", iconTone)}>
            <Icon className="size-4" aria-hidden />
          </span>
          {title}
        </h2>
        {action}
      </div>
      <ul className="grid gap-3 sm:grid-cols-2">{children}</ul>
    </section>
  );
}

function CareerLabel({ career }: { career: HomeCareer }) {
  return (
    <span className="flex min-w-0 items-center gap-3">
      <UniversityBadge id={career.universityId} label={career.universityShort} size="sm" />
      <span className="min-w-0 truncate font-semibold">{career.name}</span>
    </span>
  );
}

function ProgressBar({ value, label }: { value: number; label: string }) {
  return (
    <div
      className="h-2 overflow-hidden rounded-full bg-muted"
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <div className="h-full rounded-full bg-brand-gradient" style={{ width: `${value}%` }} />
    </div>
  );
}

const card = "flex h-full flex-col gap-4 rounded-2xl border bg-card p-4 sm:p-5";

/** Módulo 2 · Un plan de estudios por carrera: avance, examen del día, estadísticas y exámenes. */
export function StudyPlanModule({ careers }: { careers: HomeCareer[] }) {
  const plans = careers.filter((c) => c.planProgress !== null);

  return (
    <HomeModule
      id="plan"
      title="Plan de estudios"
      icon={BookOpen}
      tone="brand"
      action={
        <Button variant="outline" size="sm" disabled title="Próximamente">
          <Plus /> <span className="sr-only sm:not-sr-only">Plan de estudios</span>
          <span className="sm:hidden" aria-hidden>
            Plan
          </span>
        </Button>
      }
    >
      {plans.length === 0 ? (
        <li className={cn(card, "items-center justify-center border-dashed text-center text-sm text-muted-foreground sm:col-span-2")}>
          Aún no tienes un plan de estudios. Crea uno para entrenar día a día.
        </li>
      ) : (
        plans.map((career) => (
          <li key={career.id} className={card}>
            <CareerLabel career={career} />
            <div className="flex flex-col gap-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Avance del plan</span>
                <span className="font-semibold">{career.planProgress}%</span>
              </div>
              <ProgressBar value={career.planProgress ?? 0} label={`Avance del plan de ${career.name}`} />
            </div>
            <div className="mt-auto flex flex-col gap-2">
              <Button variant="brand" className="w-full" disabled title="Próximamente">
                <CalendarCheck /> Examen del día
              </Button>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" size="sm" disabled title="Próximamente">
                  <BarChart3 /> Estadísticas
                </Button>
                <Button variant="outline" size="sm" disabled title="Próximamente">
                  <History /> Ver exámenes
                </Button>
              </div>
            </div>
          </li>
        ))
      )}
    </HomeModule>
  );
}

const dateFmt = new Intl.DateTimeFormat("es-MX", {
  day: "numeric",
  month: "short",
});

/** Récord de exámenes libres de la carrera: totales, tendencia y una barra por examen. */
function ExamRecord({ exams }: { exams: PastExam[] }) {
  if (exams.length === 0) {
    return (
      <p className="rounded-xl border border-dashed p-3 text-sm text-muted-foreground">
        Aún no presentas ningún examen libre de esta carrera.
      </p>
    );
  }

  const last = exams[exams.length - 1];
  const prev = exams.length > 1 ? exams[exams.length - 2] : null;
  const best = Math.max(...exams.map((e) => e.score));
  const delta = prev ? last.score - prev.score : null;
  const recent = exams.slice(-8);

  return (
    <div className="flex flex-col gap-3 rounded-xl bg-muted/40 p-3">
      <dl className="grid grid-cols-3 gap-2 text-center">
        <Stat label="Presentados" value={String(exams.length)} />
        <Stat label="Mejor" value={`${best}%`} />
        <Stat label="Último" value={`${last.score}%`} />
      </dl>
      <div className="flex items-end gap-1.5" aria-hidden>
        {recent.map((e) => {
          const isLast = e.id === last.id;
          return (
            <span key={e.id} className="flex min-w-0 flex-1 flex-col items-center gap-1">
              <span className={cn("text-[10px] font-semibold", isLast ? "text-secondary" : "text-muted-foreground")}>{e.score}</span>
              <span className="flex h-20 w-full items-end">
                <span
                  className={cn("w-full rounded-sm", isLast ? "bg-secondary" : "bg-secondary/35")}
                  style={{ height: `${Math.max(e.score, 4)}%` }}
                  title={`${e.level} · ${e.score}%`}
                />
              </span>
              <span className="truncate text-[10px] text-muted-foreground">{dateFmt.format(new Date(`${e.date}T12:00:00`))}</span>
            </span>
          );
        })}
      </div>
      <p className="sr-only">Calificaciones recientes: {recent.map((e) => `${e.score}%`).join(", ")}.</p>
      {delta !== null && (
        <p className={cn("flex items-center gap-1.5 text-xs font-medium", delta >= 0 ? "text-secondary" : "text-gold")}>
          {delta >= 0 ? <TrendingUp className="size-4" aria-hidden /> : <TrendingDown className="size-4" aria-hidden />}
          {delta >= 0 ? "+" : ""}
          {delta} puntos vs. el examen anterior
        </p>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] text-muted-foreground">{label}</dt>
      <dd className="text-lg font-bold">{value}</dd>
    </div>
  );
}

/** Módulo 3 · Examen libre por carrera: récord, guías de estudio y el botón para presentar. */
export function FreeExamModule({ careers }: { careers: HomeCareer[] }) {
  return (
    <HomeModule id="examen-libre" title="Examen libre" icon={NotebookPen} tone="secondary">
      {careers.map((career) => (
        <li key={career.id} className={card}>
          <CareerLabel career={career} />
          <ExamRecord exams={career.exams} />
          <div className="mt-auto flex flex-col gap-2">
            <Button variant="brand" size="lg" className="w-full" asChild>
              <Link href={`/app/student/exam?carrera=${encodeURIComponent(career.id)}`}>
                <NotebookPen /> Presentar examen <ChevronRight />
              </Link>
            </Button>
            <Button variant="outline" size="sm" disabled title="Próximamente">
              <Library /> Guías de estudio
            </Button>
          </div>
        </li>
      ))}
    </HomeModule>
  );
}

/** Módulo 4 · Rachas (micro exámenes). Se activan por carrera; la lógica llega después. */
export function StreaksModule({ careers, onActivate }: { careers: HomeCareer[]; onActivate: (careerId: string) => void }) {
  return (
    <HomeModule id="rachas" title="Rachas" icon={Flame} tone="energy">
      {careers.map((career) => {
        const active = career.streakDays !== null;
        return (
          <li key={career.id} className={cn(card, active && "border-energy/40")}>
            <CareerLabel career={career} />
            {active ? (
              <div className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2">
                  <Flame className="size-7 fill-energy/40 text-energy" aria-hidden />
                  <span>
                    <span className="text-2xl font-bold text-energy">{career.streakDays}</span>
                    <span className="ml-1 text-sm text-muted-foreground">{career.streakDays === 1 ? "día" : "días"}</span>
                  </span>
                </span>
                <Button variant="energy" size="sm" disabled title="Próximamente">
                  Micro examen de hoy
                </Button>
              </div>
            ) : (
              <Button variant="outline" className="w-full" onClick={() => onActivate(career.id)}>
                <Flame className="text-energy" /> Activar racha
              </Button>
            )}
          </li>
        );
      })}
    </HomeModule>
  );
}
