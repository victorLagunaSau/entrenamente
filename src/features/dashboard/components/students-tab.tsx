"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, BarChart3, CalendarDays, CircleCheck, CircleDashed, FileText, Lock, Sparkles, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { TUTOR_COPY } from "../lib/tutor-plans";
import { computeStats } from "../lib/tutor-stats";
import { getTutorExams, studentLimit, type TutorExam, type TutorStudent } from "../services/tutor-service";
import { InviteButton } from "./invite-dialog";
import { NoPlanHero } from "./no-plan-hero";
import { articleFor, Avatar, examAccuracy, PerformanceAlert, wrongOf } from "./student-bits";
import { StudentMonitor } from "./student-monitor";
import { AccessBadge, ActivateWithPlan, TrialMeter } from "./student-trial";
import { useTutor } from "./tutor-context";
import { InactiveWall } from "./tutor-dashboard";

/** Pestaña Estudiantes: sin plan, la ficha de prueba del estudiante; con plan, el monitoreo de cada uno. */
export function StudentsTab() {
  const { lapsed, panel } = useTutor();
  if (lapsed) return <InactiveWall />;
  // Sin plan (demo): el anuncio arriba y la ficha completa del estudiante; lo de pago se ve pero bloqueado.
  // Con plan: el monitoreo completo de cada estudiante.
  if (panel!.license) return <StudentMonitor />;
  return (
    <div className="flex flex-col gap-6">
      <NoPlanHero compact />
      <StudentsList />
    </div>
  );
}

/** Sin plan se sigue a 1 estudiante: para invitar a otro hay que activar el plan. */
function InviteGate({ variant }: { variant?: "brand" | "outline" }) {
  const { panel } = useTutor();
  if (panel!.students.length < studentLimit(panel!)) return <InviteButton variant={variant} />;
  return (
    <div className="flex flex-col items-start gap-1 sm:items-end">
      <ActivateWithPlan label="Activa tu plan para invitar a otro" className="h-10" />
      <p className="text-xs text-muted-foreground">Sin plan puedes dar seguimiento a 1 estudiante.</p>
    </div>
  );
}

type Pulse = { exams: number; accuracy: number | null; hours: number; last: TutorExam | null; list: TutorExam[] };

/** Resumen del entrenamiento de cada estudiante (exámenes, promedio, último examen). */
function usePulses(students: TutorStudent[]) {
  const ids = students.map((s) => s.id).join(",");
  const [pulses, setPulses] = React.useState<Map<string, Pulse> | null>(null);
  React.useEffect(() => {
    let active = true;
    getTutorExams(ids ? ids.split(",") : [])
      .then((exams) => {
        if (!active) return;
        const map = new Map<string, Pulse>();
        for (const id of ids.split(",")) {
          const own = exams.filter((e) => e.studentId === id);
          const st = computeStats(own);
          map.set(id, { exams: st.exams, accuracy: st.accuracy, hours: st.hours, last: own.at(-1) ?? null, list: own });
        }
        setPulses(map);
      })
      .catch(() => active && setPulses(new Map()));
    return () => {
      active = false;
    };
  }, [ids]);
  return pulses;
}

function StudentsList() {
  const { kind, panel } = useTutor();
  const students = panel!.students;
  const pulses = usePulses(students);

  if (students.length === 0) {
    return (
      <section className="flex flex-col items-center gap-3 rounded-2xl border border-dashed px-6 py-12 text-center">
        <span className="grid size-12 place-items-center rounded-xl bg-primary/15 text-brand-light">
          <Users className="size-6" aria-hidden />
        </span>
        <h2 className="text-lg font-bold">Aún no hay estudiantes vinculados</h2>
        <p className="max-w-sm text-sm text-muted-foreground text-pretty">
          Usa «Invitar Estudiante» y comparte el enlace con {TUTOR_COPY[kind].students}. Aparecerán aquí en cuanto se
          registren.
        </p>
        <InviteButton />
      </section>
    );
  }

  const limit = studentLimit(panel!);
  return (
    <section aria-labelledby="students-title" className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 id="students-title" className="text-lg font-bold">
            Tu estudiante
          </h2>
          <p className="text-sm text-muted-foreground">Todo lo que entrena en su prueba gratuita, en un solo lugar.</p>
        </div>
        <InviteGate variant="outline" />
      </div>
      {students.map((s, i) => (
        <StudentSpotlight key={s.id} student={s} pulse={pulses?.get(s.id)} locked={i >= limit} />
      ))}
      <UnlockCards />
    </section>
  );
}

/** "Examen 1: Listo · Examen 2: No realizado…" — una línea por prueba permitida. */
function ExamStatus({ student, pulse }: { student: TutorStudent; pulse: Pulse | undefined }) {
  if (!pulse) return <p className="text-sm text-muted-foreground">Cargando sus exámenes…</p>;
  const numbered = pulse.list.filter((e) => e.pruebaNumero !== null);
  const done = (numbered.length ? numbered : pulse.list).map((e, i) => ({ exam: e, n: e.pruebaNumero ?? i + 1 }));
  const slots = Math.max(student.trial?.granted ?? 3, done.at(-1)?.n ?? 0);

  return (
    <ol className="flex flex-col gap-2">
      {Array.from({ length: slots }, (_, i) => {
        const item = done.find((d) => d.n === i + 1);
        return (
          <li
            key={i}
            className={cn(
              "flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl border px-3 py-2.5",
              item ? "border-secondary/40 bg-secondary/10" : "border-dashed"
            )}
          >
            {item ? (
              <CircleCheck className="size-5 shrink-0 text-secondary" aria-hidden />
            ) : (
              <CircleDashed className="size-5 shrink-0 text-muted-foreground" aria-hidden />
            )}
            <span className="flex-1 font-semibold">Examen {i + 1}</span>
            {item ? (
              <>
                <span className="hidden text-xs text-muted-foreground sm:inline">
                  {new Date(item.exam.completedAt).toLocaleDateString("es-MX", { day: "numeric", month: "short" })}
                </span>
                <span className="rounded-full bg-secondary/20 px-2.5 py-0.5 text-xs font-bold text-secondary">
                  Listo · {examAccuracy(item.exam)}%
                </span>
              </>
            ) : (
              <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">No realizado</span>
            )}
            {item && (
              <div className="flex w-full items-center gap-3 pl-8 text-xs">
                <span className="text-cool tabular-nums">
                  {item.exam.totalQuestions} preguntas · <strong className="text-foreground">{wrongOf(item.exam)}</strong> mal
                  contestadas
                </span>
                <Link
                  href={`/app/dashboard/analytics?alumno=${student.id}&examen=${item.exam.id}`}
                  className="ml-auto inline-flex items-center gap-1 font-semibold text-brand-light underline-offset-4 hover:underline"
                >
                  <BarChart3 className="size-3.5" aria-hidden /> Ver resultados
                </Link>
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}

/**
 * Ficha del estudiante del padre sin plan: aspiracional (quién es y a qué universidad aspira), el estatus de sus
 * evaluaciones con una alerta de desempeño y, como protagonista, "Activar tu plan".
 */
function StudentSpotlight({ student, pulse, locked }: { student: TutorStudent; pulse: Pulse | undefined; locked: boolean }) {
  const { kind } = useTutor();
  const name = student.fullName || student.alias;

  if (locked) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-dashed bg-card/60 p-5 opacity-70">
        <Avatar name={name} />
        <p className="min-w-0 flex-1 font-semibold">{name}</p>
        <ActivateWithPlan label="Amplía tu plan para verlo" />
      </div>
    );
  }

  return (
    <article className="overflow-hidden rounded-3xl border bg-card">
      {/* Identidad y aspiración: lo primero que ve el papá, justo debajo del anuncio. */}
      <div className="relative flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:p-7">
        <div aria-hidden className="pointer-events-none absolute -top-24 -left-16 size-72 rounded-full bg-primary/15 blur-3xl" />
        <Avatar name={name} size="lg" />
        <div className="relative min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2 text-xs font-semibold tracking-wide text-secondary uppercase">
            Tu {TUTOR_COPY[kind].student}
            <AccessBadge access={student.access} />
          </p>
          <h3 className="font-display text-2xl leading-tight font-bold text-balance sm:text-3xl">{name}</h3>
          <p className="mt-1 text-base text-cool text-pretty sm:text-lg">
            {student.career ? (
              <>
                Aspirante a <strong className="text-foreground">{student.career}</strong>
                {student.university && (
                  <>
                    {" "}
                    en {articleFor(student.university)} <strong className="text-foreground">{student.university}</strong>
                  </>
                )}
              </>
            ) : (
              "Aún no elige carrera"
            )}
          </p>
        </div>
        <div className="relative sm:w-56">
          <TrialMeter student={student} compact />
        </div>
      </div>

      <div className="grid gap-5 border-t p-5 sm:p-7 lg:grid-cols-[1.1fr_1fr]">
        <div className="flex flex-col gap-3">
          <h4 className="font-bold">Estatus de sus evaluaciones</h4>
          <ExamStatus student={student} pulse={pulse} />
          {pulse && pulse.exams > 0 && pulse.accuracy !== null && <PerformanceAlert alias={student.alias} accuracy={pulse.accuracy} />}
        </div>

        {/* El protagonista: activar el plan. */}
        <div className="relative flex flex-col justify-center gap-4 overflow-hidden rounded-2xl bg-[linear-gradient(135deg,var(--gold),var(--secondary)_50%,var(--primary))] p-px">
          <div className="flex h-full flex-col items-center justify-center gap-3 rounded-[calc(1rem-1px)] bg-card/95 p-5 text-center">
            <span className="grid size-12 place-items-center rounded-2xl bg-brand-gradient text-white shadow-glow-secondary">
              <Sparkles className="size-6" aria-hidden />
            </span>
            <p className="font-display text-lg font-bold text-balance">
              Que se prepare con la mejor herramienta para{" "}
              {student.university ? `${articleFor(student.university)} ${student.university}` : "su examen"}
            </p>
            <ul className="flex flex-col gap-1 text-left text-sm text-cool">
              {[
                "Miles de preguntas tipo examen de admisión",
                "Simulacros ilimitados y su plan de práctica",
                "Guías con la solución de cada error",
              ].map((t) => (
                <li key={t} className="flex gap-2">
                  <CircleCheck className="mt-0.5 size-4 shrink-0 text-secondary" aria-hidden /> {t}
                </li>
              ))}
            </ul>
            <Button asChild variant="brand" size="lg" className="group w-full text-base">
              <Link href="/app/dashboard/billing">
                Activar tu plan <ArrowRight className="transition-transform group-hover:translate-x-0.5" />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </article>
  );
}

const UNLOCKS = [
  {
    icon: CalendarDays,
    title: "Programa su plan de exámenes",
    text: "Elige la fecha de su examen de admisión, los días de práctica y el nivel. Le armamos su calendario y tú ves si cumple cada día.",
  },
  {
    icon: Users,
    title: "Gestión de estudiantes y grupos",
    text: "Agrega a más de un estudiante y clasifícalos por grupo para seguirlos a todos desde aquí.",
  },
  {
    icon: FileText,
    title: "Reportes detallados",
    text: "Obtén reportes y guías de retroalimentación con las preguntas en las que se equivocó.",
  },
];

/** Lo que desbloquea el plan: tres tarjetas con su "Activar ahora". */
function UnlockCards() {
  return (
    <ul className="grid gap-3 md:grid-cols-3">
      {UNLOCKS.map((u) => (
        <li
          key={u.title}
          className="group relative flex flex-col gap-3 overflow-hidden rounded-2xl border bg-card p-5 transition-colors hover:border-secondary/50"
        >
          <div aria-hidden className="pointer-events-none absolute -top-12 -right-12 size-32 rounded-full bg-secondary/10 blur-2xl transition-opacity group-hover:opacity-100" />
          <div className="relative flex items-center gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/15 text-brand-light">
              <u.icon className="size-5" aria-hidden />
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-gold/10 px-2 py-0.5 text-[11px] font-semibold text-gold">
              <Lock className="size-3" aria-hidden /> Con tu plan
            </span>
          </div>
          <h4 className="relative font-bold">{u.title}</h4>
          <p className="relative flex-1 text-sm text-muted-foreground text-pretty">{u.text}</p>
          <Button asChild variant="brand" size="sm" className="relative">
            <Link href="/app/dashboard/billing">
              Activar ahora <ArrowRight />
            </Link>
          </Button>
        </li>
      ))}
    </ul>
  );
}
