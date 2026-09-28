"use client";

import * as React from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  BookOpen,
  CalendarCheck,
  ChevronRight,
  CircleCheck,
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
  listClassName = "sm:grid-cols-2",
  after,
  children,
}: {
  id: string;
  title: string;
  icon: LucideIcon;
  tone: "brand" | "secondary" | "energy";
  action?: React.ReactNode;
  listClassName?: string;
  /** Contenido secundario bajo las fichas (p. ej. accesos pequeños). */
  after?: React.ReactNode;
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
      {React.Children.count(children) > 0 && <ul className={cn("grid gap-3", listClassName)}>{children}</ul>}
      {after}
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

const weekdayFmt = new Intl.DateTimeFormat("es-MX", { weekday: "narrow" });

/** Últimos 7 días (hoy al final): encendido si ese día se resolvió el micro examen. */
function WeekFlames({ days, doneToday }: { days: number; doneToday: boolean }) {
  const before = days - (doneToday ? 1 : 0);
  const today = new Date();
  const slots = Array.from({ length: 7 }, (_, i) => {
    const offset = 6 - i;
    const date = new Date(today);
    date.setDate(today.getDate() - offset);
    const lit = offset === 0 ? doneToday : offset <= before;
    return { key: offset, lit, isToday: offset === 0, label: weekdayFmt.format(date).toUpperCase() };
  });

  return (
    <ol className="grid grid-cols-7 gap-0.5" aria-label="Últimos 7 días">
      {slots.map((s) => (
        <li key={s.key} className="flex flex-col items-center gap-0.5">
          <Flame className={cn("size-4 sm:size-5", s.lit ? "fill-energy/50 text-energy" : "text-muted-foreground/30")} aria-hidden />
          <span className={cn("text-[10px]", s.isToday ? "font-bold text-foreground" : "text-muted-foreground")}>{s.label}</span>
          <span className="sr-only">{s.lit ? "resuelto" : "sin resolver"}</span>
        </li>
      ))}
    </ol>
  );
}

/** Módulo 4 · Rachas (micro exámenes). Fichas solo para las activas; las demás, un botón chico por carrera. */
export function StreaksModule({
  careers,
  onActivate,
  onSolveToday,
}: {
  careers: HomeCareer[];
  onActivate: (careerId: string) => void;
  onSolveToday: (careerId: string) => void;
}) {
  const active = careers.filter((c) => c.streakDays !== null);
  const inactive = careers.filter((c) => c.streakDays === null);

  return (
    <HomeModule
      id="rachas"
      title="Rachas"
      icon={Flame}
      tone="energy"
      listClassName="grid-cols-2 lg:grid-cols-4"
      after={
        inactive.length > 0 && (
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3" aria-label="Carreras sin racha">
            {inactive.map((career) => (
              <li key={career.id} className="min-w-0">
                <button
                  type="button"
                  onClick={() => onActivate(career.id)}
                  className="group flex w-full items-center gap-3 rounded-xl border border-energy/25 bg-energy/5 p-2.5 pr-3 text-left transition-colors hover:border-energy/50 hover:bg-energy/10 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
                >
                  <UniversityBadge id={career.universityId} label={career.universityShort} size="sm" />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm font-semibold">{career.name}</span>
                    <span className="text-xs font-medium text-energy">Activar racha</span>
                  </span>
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-energy/15 text-energy transition-colors group-hover:bg-energy/25">
                    <Flame className="size-4" aria-hidden />
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )
      }
    >
      {active.map((career) => {
        const days = career.streakDays ?? 0;
        return (
          <li key={career.id} className={cn(card, "gap-3 border-energy/40 p-3 sm:p-5")}>
            <UniversityBadge id={career.universityId} label={career.universityShort} size="sm" className="self-start" />
            <p className="line-clamp-2 min-h-10 text-sm leading-5 font-semibold">{career.name}</p>
            <p className="flex items-baseline gap-1.5">
              <span className="text-3xl font-bold text-energy">{days}</span>
              <span className="text-sm text-muted-foreground">{days === 1 ? "día de racha" : "días de racha"}</span>
            </p>
            <WeekFlames days={days} doneToday={career.streakDoneToday} />
            {career.streakDoneToday ? (
              <p className="mt-auto flex h-10 items-center justify-center gap-2 rounded-md border border-secondary/40 bg-secondary/10 text-sm font-semibold text-secondary">
                <CircleCheck className="size-4" aria-hidden /> Hoy resuelto
              </p>
            ) : (
              <Button variant="energy" className="mt-auto w-full" onClick={() => onSolveToday(career.id)}>
                <Flame /> Examen de hoy
              </Button>
            )}
          </li>
        );
      })}
    </HomeModule>
  );
}
