"use client";

import * as React from "react";
import Link from "next/link";
import { BarChart3, CircleAlert, Gift, Loader2, Power, PowerOff, Sparkles, UserMinus, Users } from "lucide-react";

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
  unlinkStudent,
  type TutorExam,
  type TutorStudent,
} from "../services/tutor-service";
import { GroupChips, GroupSelect, type GroupFilter } from "./groups";
import { InviteButton } from "./invite-dialog";
import { AccessBadge, ActivateWithPlan, TrialMeter, trialDaysLeft } from "./student-trial";
import { useTutor } from "./tutor-context";
import { InactiveWall } from "./tutor-dashboard";

/** Pestaña Estudiantes: cupos de la licencia, invitación, grupos y la lista de estudiantes vinculados. */
export function StudentsTab() {
  const { lapsed } = useTutor();
  if (lapsed) return <InactiveWall />;
  return (
    <div className="flex flex-col gap-6">
      <LicenseBar />
      <StudentsList />
    </div>
  );
}

function LicenseBar() {
  const { kind, panel } = useTutor();
  const license = panel!.license;

  if (!license) return <DemoHero />;

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
      <InviteButton />
    </section>
  );
}

/**
 * Padre sin plan (demo): ve todo lo que entrenan sus estudiantes durante su prueba gratuita,
 * con el contador del periodo y la invitación a activar su plan.
 */
function DemoHero() {
  const { kind, panel } = useTutor();
  const inTrial = panel!.students.filter((s) => s.access === "prueba" && s.trial);
  const soonest = inTrial.reduce<number | null>((min, s) => {
    const d = trialDaysLeft(s.trial!.endsAt);
    return min === null || d < min ? d : min;
  }, null);

  return (
    <section className="relative overflow-hidden rounded-2xl border border-gold/30 bg-card p-5 sm:p-6">
      <div aria-hidden className="pointer-events-none absolute -top-24 -right-20 size-64 rounded-full bg-gold/10 blur-3xl" />
      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center">
        <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-gold/15 text-gold">
          <Gift className="size-6" aria-hidden />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <p className="text-xs font-semibold tracking-wide text-gold uppercase">Periodo de prueba</p>
          <h2 className="text-lg font-bold text-balance">
            {soonest === null
              ? `Invita a ${TUTOR_COPY[kind].students} y mira cómo entrenan`
              : soonest === 0
                ? "La prueba gratuita termina hoy"
                : `Quedan ${soonest} ${soonest === 1 ? "día" : "días"} de prueba gratuita`}
          </h2>
          <p className="text-sm text-muted-foreground text-pretty">
            Durante la prueba ves todo lo que entrenan: exámenes, calificaciones y avance por materia. Activa tu plan
            para que sigan sin límites y desbloquear reportes y cupos.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:items-end">
          <Button asChild variant="brand">
            <Link href="/app/dashboard/billing">
              <Sparkles /> Activa tu plan
            </Link>
          </Button>
          <InviteButton variant="outline" />
        </div>
      </div>
    </section>
  );
}

type Pulse = { exams: number; accuracy: number | null; hours: number; last: TutorExam | null };

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
          map.set(id, { exams: st.exams, accuracy: st.accuracy, hours: st.hours, last: own.at(-1) ?? null });
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

function StudentsList() {
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
