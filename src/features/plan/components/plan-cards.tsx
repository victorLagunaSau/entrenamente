"use client";

import * as React from "react";
import Link from "next/link";
import { BarChart3, CalendarDays, Check, ChevronRight, CircleAlert, Clock, Coffee, FlaskConical, NotebookPen, Play, Repeat, Trophy } from "lucide-react";

import { UniversityBadge } from "@/components/layout/university-badge";
import { Button } from "@/components/ui/button";
import { PRUEBA_VOLUMEN } from "@/features/exam/lib/libre";
import { cn } from "@/lib/utils";

import {
  addDays,
  completedSessions,
  daysBetween,
  DIAS,
  dueSessions,
  ESTADOS,
  estadoDe,
  formatFull,
  formatLong,
  formatWindow,
  nextSession,
  planEnded,
  recentAverage,
  type StudentPlan,
  todayISO,
  weekdayIndex,
} from "../lib/plan";

export const planHref = (plan: StudentPlan, section?: "calendario" | "estadisticas") =>
  `/app/student/plan?id=${plan.id}${section ? `#${section}` : ""}`;

const examHref = (sessionId: number, prueba = false) => `/app/student/plan/examen?sesion=${sessionId}${prueba ? "&prueba=1" : ""}`;

/**
 * Acceso directo sin fricción: si hay examen de hoy (o atrasado), un botón lo abre sin pedir nada más.
 * Si no, cuándo es el siguiente y en qué horario.
 */
export function PlanTodayCard({ plan, className }: { plan: StudentPlan; className?: string }) {
  const today = todayISO();
  const due = dueSessions(plan, today);
  const next = nextSession(plan, today);
  const first = due[0];

  if (planEnded(plan, today)) {
    return (
      <div className={cn("flex items-center gap-3 rounded-xl border border-gold/40 bg-gold/10 p-3 text-sm", className)}>
        <Trophy className="size-5 shrink-0 text-gold" aria-hidden />
        <span>Llegó el día de tu examen oficial. ¡Mucho éxito! Crea un plan nuevo cuando quieras seguir entrenando.</span>
      </div>
    );
  }

  if (!first) {
    return (
      <div className={cn("flex items-center gap-3 rounded-xl bg-muted/40 p-3 text-sm", className)}>
        <Coffee className="size-5 shrink-0 text-brand-light" aria-hidden />
        <span className="text-muted-foreground">
          {next ? (
            <>
              Hoy descansas. Siguiente examen: <strong className="text-foreground">{formatLong(next.date)}</strong>
              <span className="block text-xs">Tu horario: {formatWindow(plan.timeWindow)}</span>
            </>
          ) : (
            "Ya no tienes exámenes pendientes antes de tu examen oficial."
          )}
        </span>
      </div>
    );
  }

  const overdue = first.date < today;
  const todayCount = due.filter((s) => s.date === today).length;
  const late = due.length - todayCount;

  return (
    <div className={cn("flex flex-col gap-3 rounded-xl border border-secondary/40 bg-secondary/10 p-3", className)}>
      <div className="flex items-start gap-3 text-sm">
        {first.kind === "refuerzo" ? (
          <Repeat className="mt-0.5 size-5 shrink-0 text-energy" aria-hidden />
        ) : overdue ? (
          <CircleAlert className="mt-0.5 size-5 shrink-0 text-gold" aria-hidden />
        ) : (
          <NotebookPen className="mt-0.5 size-5 shrink-0 text-secondary" aria-hidden />
        )}
        <p className="flex-1">
          <strong>
            {todayCount > 0 ? (todayCount === 1 ? "Tienes 1 examen hoy" : `Tienes ${todayCount} exámenes hoy`) : "Tienes exámenes atrasados"}
          </strong>
          {late > 0 && todayCount > 0 && <span className="text-gold"> · {late} atrasado{late > 1 ? "s" : ""}</span>}
          <span className="block text-xs text-muted-foreground">
            {first.kind === "refuerzo" ? "Te toca un examen de refuerzo para recuperar el nivel. " : ""}
            {overdue ? `El pendiente es del ${formatLong(first.date)}. ` : ""}
            Tu horario: {formatWindow(plan.timeWindow)}
          </span>
        </p>
      </div>
      <Button variant="brand" size="lg" className="w-full" asChild>
        <Link href={examHref(first.id)}>
          <Play /> Iniciar examen de hoy
        </Link>
      </Button>
      {/* ⚠️ Temporal (igual que en Examen Libre): examen corto para probar la interfaz. */}
      <Link
        href={examHref(first.id, true)}
        className="inline-flex items-center gap-1.5 self-end rounded-full border border-dashed px-3 py-1 font-mono text-xs text-muted-foreground transition-colors hover:border-foreground/40 hover:text-foreground"
      >
        <FlaskConical className="size-3.5" /> Prueba · {PRUEBA_VOLUMEN[0]}–{PRUEBA_VOLUMEN[1]}
      </Link>
    </div>
  );
}

/** Semana actual (lunes a domingo): qué hay cada día. */
export function PlanWeekStrip({ plan }: { plan: StudentPlan }) {
  const today = todayISO();
  const monday = addDays(today, -weekdayIndex(today));
  const days = DIAS.map((d, i) => {
    const date = addDays(monday, i);
    const sessions = plan.sessions.filter((s) => s.date === date);
    const done = sessions.filter((s) => s.exam);
    const pending = sessions.length - done.length;
    const avg = done.length ? Math.round(done.reduce((n, s) => n + (s.exam?.score ?? 0), 0) / done.length) : null;
    return { ...d, date, pending, avg, isToday: date === today, official: date === plan.officialDate };
  });

  return (
    <ol className="grid grid-cols-7 gap-1" aria-label="Esta semana">
      {days.map((d) => (
        <li
          key={d.key}
          className={cn("flex flex-col items-center gap-1 rounded-lg py-1.5", d.isToday && "bg-secondary/10 ring-1 ring-secondary/50")}
        >
          <span className={cn("text-[10px]", d.isToday ? "font-bold text-foreground" : "text-muted-foreground")}>{d.corto}</span>
          {d.official ? (
            <Trophy className="size-4 text-gold" aria-label="Examen oficial" />
          ) : d.avg !== null && d.pending === 0 ? (
            <span className={cn("grid size-6 place-items-center rounded-full", ESTADOS[estadoDe(d.avg)].bg)} title={`${d.avg} %`}>
              <Check className={cn("size-3.5", ESTADOS[estadoDe(d.avg)].text)} aria-label={`Presentado, ${d.avg} %`} />
            </span>
          ) : d.pending > 0 ? (
            <span
              className={cn(
                "grid size-6 place-items-center rounded-full text-[10px] font-bold",
                d.date < todayISO() ? "bg-gold/15 text-gold" : "bg-primary/20 text-brand-light"
              )}
              aria-label={`${d.pending} pendiente${d.pending > 1 ? "s" : ""}`}
            >
              {d.pending > 1 ? d.pending : <NotebookPen className="size-3" aria-hidden />}
            </span>
          ) : (
            <span className="size-6" aria-label="Sin examen" />
          )}
        </li>
      ))}
    </ol>
  );
}

/** Ficha del plan en el home: examen de hoy, semana, promedio de los últimos 3 y accesos al calendario y estadísticas. */
export function PlanHomeCard({ plan }: { plan: StudentPlan }) {
  const today = todayISO();
  const left = daysBetween(today, plan.officialDate);
  const done = completedSessions(plan).length;
  const total = plan.sessions.length;
  const progress = total ? Math.round((done / total) * 100) : 0;
  const recent = recentAverage(plan);

  return (
    <li className="flex h-full flex-col gap-4 rounded-2xl border bg-card p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <span className="flex min-w-0 items-center gap-3">
          <UniversityBadge id={plan.universityKey.toLowerCase()} label={plan.universityKey} size="sm" />
          <span className="flex min-w-0 flex-col">
            <span className="truncate font-semibold">{plan.careerName}</span>
            <span className="text-xs text-muted-foreground">Examen oficial: {formatFull(plan.officialDate)}</span>
          </span>
        </span>
        {left > 0 && (
          <span className="shrink-0 text-right">
            <span className="block font-display text-2xl leading-none font-bold text-secondary">{left}</span>
            <span className="text-[10px] text-muted-foreground">{left === 1 ? "día" : "días"}</span>
          </span>
        )}
      </div>

      <PlanTodayCard plan={plan} />

      <PlanWeekStrip plan={plan} />

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap justify-between gap-x-3 text-sm">
          <span className="text-muted-foreground">
            Presentados {done} de {total}
          </span>
          {recent ? (
            <span className={cn("font-semibold", ESTADOS[recent.estado].text)} title={`Promedio de tus últimos ${recent.exams.length}`}>
              Últimos {recent.exams.length}: {recent.avg}% · {ESTADOS[recent.estado].nombre}
            </span>
          ) : (
            <span className="text-muted-foreground">{progress}%</span>
          )}
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label={`Avance del plan de ${plan.careerName}`}>
          <div className="h-full rounded-full bg-brand-gradient" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <div className="mt-auto grid grid-cols-2 gap-2">
        <Button variant="outline" size="sm" asChild>
          <Link href={planHref(plan, "calendario")}>
            <CalendarDays /> Calendario
          </Link>
        </Button>
        <Button variant="outline" size="sm" asChild>
          <Link href={planHref(plan, "estadisticas")}>
            <BarChart3 /> Estadísticas
          </Link>
        </Button>
        <Button variant="ghost" size="sm" className="col-span-2 text-muted-foreground" asChild>
          <Link href={planHref(plan)}>
            <Clock /> Ver plan completo <ChevronRight />
          </Link>
        </Button>
      </div>
    </li>
  );
}
