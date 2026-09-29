"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  CalendarDays,
  CircleAlert,
  CircleCheck,
  CircleDashed,
  FileText,
  Flame,
  Loader2,
  Lock,
  Power,
  PowerOff,
  Sparkles,
  ThumbsUp,
  TriangleAlert,
  UserMinus,
  Users,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

import { planName, TUTOR_COPY } from "../lib/tutor-plans";
import { computeStats, formatHours } from "../lib/tutor-stats";
import {
  activateSeat,
  errorMessage,
  getTutorExams,
  releaseSeat,
  studentLimit,
  unlinkStudent,
  type TutorExam,
  type TutorStudent,
} from "../services/tutor-service";
import { GroupChips, GroupSelect, type GroupFilter } from "./groups";
import { InviteButton } from "./invite-dialog";
import { NoPlanHero } from "./no-plan-hero";
import { AccessBadge, ActivateWithPlan, TrialMeter } from "./student-trial";
import { useTutor } from "./tutor-context";
import { InactiveWall } from "./tutor-dashboard";

/** Pestaña Estudiantes: cupos de la licencia, invitación, grupos y la lista de estudiantes vinculados. */
export function StudentsTab() {
  const { lapsed, panel } = useTutor();
  if (lapsed) return <InactiveWall />;
  // Sin plan (demo): el anuncio arriba y la ficha completa del estudiante; lo de pago se ve pero bloqueado.
  const demo = !panel!.license;
  return (
    <div className="flex flex-col gap-6">
      {demo ? <NoPlanHero /> : <LicenseBar />}
      <StudentsList demo={demo} />
    </div>
  );
}

function LicenseBar() {
  const { kind, panel } = useTutor();
  const license = panel!.license;

  if (!license) return null;

  const ratio = Math.min(license.used / license.seats, 1);
  const full = license.used >= license.seats;

  return (
    <section aria-labelledby="license-bar-title" className="flex flex-col gap-4 rounded-2xl border bg-card p-5 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{planName(kind, license)}</p>
        <h2 id="license-bar-title" className="text-lg font-bold">
          Tienes <span className="tabular-nums">{license.used}</span> de <span className="tabular-nums">{license.seats}</span>{" "}
          estudiantes activos
        </h2>
        <div
          role="meter"
          aria-label="Cupos utilizados"
          aria-valuemin={0}
          aria-valuemax={license.seats}
          aria-valuenow={license.used}
          className="h-2 w-full max-w-md overflow-hidden rounded-full bg-muted"
        >
          <div
            className={cn("h-full rounded-full transition-[width]", full ? "bg-gold" : "bg-brand-gradient")}
            style={{ width: `${ratio * 100}%` }}
          />
        </div>
        {full && (
          <p className="text-xs text-muted-foreground">
            Cupos llenos.{" "}
            <Link href="/app/dashboard/billing" className="text-brand-light underline-offset-4 hover:underline">
              Amplía tu plan
            </Link>{" "}
            para sumar más estudiantes.
          </p>
        )}
      </div>
      <InviteGate />
    </section>
  );
}

/** Invitar solo si hay lugar en el plan (sin plan: 1 estudiante). Lleno → ampliar el plan. */
function InviteGate({ variant }: { variant?: "brand" | "outline" }) {
  const { panel } = useTutor();
  if (panel!.students.length < studentLimit(panel!)) return <InviteButton variant={variant} />;
  return (
    <div className="flex flex-col items-start gap-1 sm:items-end">
      <ActivateWithPlan label={panel!.license ? "Amplía tu plan para invitar a otro" : "Activa tu plan para invitar a otro"} className="h-10" />
      <p className="text-xs text-muted-foreground">
        {panel!.license ? "Ya usaste los lugares de tu plan." : "Sin plan puedes dar seguimiento a 1 estudiante."}
      </p>
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

const lastScore = (e: TutorExam) => {
  const total = e.materias.reduce((n, m) => n + m.total, 0);
  return total ? Math.round((100 * e.materias.reduce((n, m) => n + m.correctas, 0)) / total) : null;
};

function StudentPulse({ pulse }: { pulse: Pulse | undefined }) {
  if (!pulse) return <span className="text-xs text-muted-foreground">Cargando…</span>;
  if (pulse.exams === 0) return <span className="text-sm text-muted-foreground">Aún sin exámenes</span>;
  const score = pulse.last ? lastScore(pulse.last) : null;
  return (
    <dl className="grid grid-cols-3 gap-2 text-center">
      <div className="rounded-lg bg-muted/50 px-2 py-1.5">
        <dt className="text-[11px] text-muted-foreground">Exámenes</dt>
        <dd className="font-bold tabular-nums">{pulse.exams}</dd>
      </div>
      <div className="rounded-lg bg-muted/50 px-2 py-1.5">
        <dt className="text-[11px] text-muted-foreground">Promedio</dt>
        <dd className="font-bold tabular-nums">{pulse.accuracy === null ? "—" : `${pulse.accuracy}%`}</dd>
      </div>
      <div className="rounded-lg bg-muted/50 px-2 py-1.5">
        <dt className="text-[11px] text-muted-foreground">Último</dt>
        <dd className="font-bold tabular-nums">{score === null ? "—" : `${score}%`}</dd>
      </div>
      <p className="col-span-3 text-left text-[11px] text-muted-foreground">{formatHours(pulse.hours)} de práctica</p>
    </dl>
  );
}

function StudentsList({ demo }: { demo: boolean }) {
  const { kind, panel } = useTutor();
  const [filter, setFilter] = React.useState<GroupFilter>("all");
  const students = panel!.students;
  // Si se borra el grupo que se estaba filtrando, se vuelve a "Todos".
  const activeFilter = typeof filter === "number" && !panel!.groups.some((g) => g.id === filter) ? "all" : filter;
  const visible = students.filter((s) =>
    activeFilter === "all" ? true : activeFilter === "none" ? s.groupId === null : s.groupId === activeFilter
  );
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
        {demo && <InviteButton />}
      </section>
    );
  }

  if (demo) {
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

  return (
    <section aria-labelledby="students-title" className="flex flex-col gap-3">
      <h2 id="students-title" className="text-lg font-bold">
        Estudiantes vinculados
      </h2>
      <GroupChips value={activeFilter} onChange={setFilter} />

      {visible.length === 0 ? (
        <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
          No hay estudiantes en este grupo.
        </p>
      ) : (
        <>
          {/* Computadora: tabla. Celular y tablet: fichas. */}
          <div className="hidden overflow-hidden rounded-xl border lg:block">
            <table className="w-full text-sm">
              <thead className="bg-muted/60 text-left text-xs text-muted-foreground">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium">Nombre / Alias</th>
                  <th scope="col" className="px-4 py-3 font-medium">Carrera / Universidad</th>
                  <th scope="col" className="px-4 py-3 font-medium">Entrenamiento</th>
                  <th scope="col" className="px-4 py-3 font-medium">Grupo asignado</th>
                  <th scope="col" className="px-4 py-3 font-medium">Estado de licencia</th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {visible.map((s) => (
                  <tr key={s.id} className="align-middle">
                    <td className="px-4 py-3">
                      <StudentName student={s} />
                    </td>
                    <td className="px-4 py-3">
                      <StudentGoal student={s} />
                    </td>
                    <td className="min-w-52 px-4 py-3">
                      <StudentPulse pulse={pulses?.get(s.id)} />
                    </td>
                    <td className="px-4 py-3">
                      <GroupSelect studentId={s.id} groupId={s.groupId} label={`Grupo de ${s.alias}`} />
                    </td>
                    <td className="min-w-40 px-4 py-3">
                      <div className="flex flex-col items-start gap-2">
                        <AccessBadge access={s.access} />
                        <TrialMeter student={s} compact />
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <StudentActions student={s} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="grid gap-3 md:grid-cols-2 lg:hidden">
            {visible.map((s) => (
              <li key={s.id} className="flex flex-col gap-3 rounded-xl border bg-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <StudentName student={s} />
                  <AccessBadge access={s.access} />
                </div>
                <StudentGoal student={s} />
                <TrialMeter student={s} />
                <StudentPulse pulse={pulses?.get(s.id)} />
                <GroupSelect studentId={s.id} groupId={s.groupId} label={`Grupo de ${s.alias}`} />
                <StudentActions student={s} />
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

function StudentName({ student }: { student: TutorStudent }) {
  return (
    <div className="flex min-w-0 flex-col">
      <span className="truncate font-semibold">{student.alias}</span>
      {student.fullName && student.fullName !== student.alias && (
        <span className="truncate text-xs text-muted-foreground">{student.fullName}</span>
      )}
    </div>
  );
}

function StudentGoal({ student }: { student: TutorStudent }) {
  if (!student.career) return <span className="text-sm text-muted-foreground">Sin carrera elegida</span>;
  return (
    <div className="flex min-w-0 flex-col">
      <span className="truncate">{student.career}</span>
      {student.university && <span className="text-xs text-muted-foreground">{student.university}</span>}
    </div>
  );
}

function StudentActions({ student }: { student: TutorStudent }) {
  const { panel, reload } = useTutor();
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const [confirm, setConfirm] = React.useState(false);
  const license = panel!.license;
  const canActivate = !student.active && !!license?.active;

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError("");
    try {
      await fn();
      await reload();
      setConfirm(false);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col items-stretch gap-1 lg:items-end">
      <div className="flex flex-wrap gap-1.5 lg:justify-end">
        <Button asChild variant="outline" size="sm">
          <Link href={`/app/dashboard/analytics?alumno=${student.id}`}>
            <BarChart3 /> Estadísticas
          </Link>
        </Button>
        {student.active ? (
          <Button variant="ghost" size="sm" disabled={busy} onClick={() => run(() => releaseSeat(student.id))}>
            {busy ? <Loader2 className="animate-spin" /> : <PowerOff />} Liberar cupo
          </Button>
        ) : canActivate ? (
          <Button variant="ghost" size="sm" disabled={busy} onClick={() => run(() => activateSeat(student.id))}>
            {busy ? <Loader2 className="animate-spin" /> : <Power />} Activar
          </Button>
        ) : (
          // Sin plan: la acción se ve, pero lleva a activar el plan.
          !license && student.access !== "otra" && <ActivateWithPlan />
        )}
        <Button
          variant="ghost"
          size="sm"
          className="hover:text-destructive"
          aria-label={`Quitar a ${student.alias}`}
          onClick={() => setConfirm(true)}
        >
          <UserMinus />
        </Button>
      </div>
      {error && !confirm && (
        <p role="alert" className="flex items-center gap-1.5 text-xs text-destructive">
          <CircleAlert className="size-3.5 shrink-0" /> {error}
        </p>
      )}

      <Dialog open={confirm} onOpenChange={setConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Quitar a {student.alias} de tu panel?</DialogTitle>
            <DialogDescription>
              Se libera su cupo y dejarás de ver sus estadísticas. Su cuenta y su historial de exámenes no se borran.
            </DialogDescription>
          </DialogHeader>
          {error && (
            <p role="alert" className="flex items-center gap-2 text-sm text-destructive">
              <CircleAlert className="size-4 shrink-0" /> {error}
            </p>
          )}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={() => setConfirm(false)}>
              Cancelar
            </Button>
            <Button variant="default" className="bg-destructive hover:bg-destructive/90" disabled={busy} onClick={() => run(() => unlinkStudent(student.id))}>
              {busy && <Loader2 className="animate-spin" />} Quitar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const ALERT_TONE = {
  low: {
    icon: TriangleAlert,
    tone: "border-energy/40 bg-energy/10",
    iconTone: "text-energy",
    title: "Le falta mucha práctica",
  },
  mid: { icon: ThumbsUp, tone: "border-gold/40 bg-gold/10", iconTone: "text-gold", title: "Muy bien, pero necesita reforzar" },
  high: { icon: Flame, tone: "border-success/40 bg-success/10", iconTone: "text-success", title: "¡Excelente! Que mantenga este ritmo" },
} as const;

/** Alerta según el % de aciertos promedio: <50 le falta práctica, 50–75 reforzar, >75 excelente. */
function PerformanceAlert({ alias, accuracy }: { alias: string; accuracy: number }) {
  const level = accuracy > 75 ? "high" : accuracy >= 50 ? "mid" : "low";
  const a = ALERT_TONE[level];
  const detail = {
    low: `${alias} lleva ${accuracy}% de aciertos. Con práctica diaria y su guía de estudio sube rápido.`,
    mid: `${alias} lleva ${accuracy}% de aciertos. Va por buen camino: repasar sus fallas lo acerca a su meta.`,
    high: `${alias} lleva ${accuracy}% de aciertos. Está listo para subir de nivel.`,
  }[level];
  return (
    <div role="status" className={cn("flex gap-3 rounded-xl border p-3", a.tone)}>
      <a.icon className={cn("mt-0.5 size-5 shrink-0", a.iconTone)} aria-hidden />
      <div className="min-w-0 text-sm">
        <p className="font-bold">{a.title}</p>
        <p className="text-cool text-pretty">{detail}</p>
      </div>
    </div>
  );
}

const examAccuracy = (e: TutorExam) => {
  const total = e.materias.reduce((n, m) => n + m.total, 0);
  return total ? Math.round((100 * e.materias.reduce((n, m) => n + m.correctas, 0)) / total) : 0;
};

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
              "flex items-center gap-3 rounded-xl border px-3 py-2.5",
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
                <span className="text-xs text-muted-foreground">
                  {new Date(item.exam.completedAt).toLocaleDateString("es-MX", { day: "numeric", month: "short" })}
                </span>
                <span className="rounded-full bg-secondary/20 px-2.5 py-0.5 text-xs font-bold text-secondary">
                  Listo · {examAccuracy(item.exam)}%
                </span>
              </>
            ) : (
              <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">No realizado</span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

const articleFor = (u: string) => (/^(IPN|POLI|TEC)$/i.test(u) ? "el" : "la");

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
        <Avatar name={name} large />
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
          <div className="flex items-center justify-between gap-2">
            <h4 className="font-bold">Estatus de sus evaluaciones</h4>
            <Link
              href={`/app/dashboard/analytics?alumno=${student.id}`}
              className="inline-flex items-center gap-1 text-sm text-brand-light underline-offset-4 hover:underline"
            >
              <BarChart3 className="size-4" aria-hidden /> Ver resultados
            </Link>
          </div>
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
              Asegura su lugar en {student.university ? `${articleFor(student.university)} ${student.university}` : "la universidad"}
            </p>
            <p className="text-sm text-muted-foreground text-pretty">
              Con tu plan, {student.alias} entrena sin límites y tú sigues cada examen, cada materia y su avance diario.
            </p>
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

function Avatar({ name, large }: { name: string; large?: boolean }) {
  return (
    <span
      className={cn(
        "relative grid shrink-0 place-items-center rounded-full bg-brand-gradient font-display font-bold text-white",
        large ? "size-16 text-2xl shadow-glow-secondary sm:size-20 sm:text-3xl" : "size-12 text-lg"
      )}
    >
      {name.trim().charAt(0).toUpperCase() || "?"}
    </span>
  );
}
