"use client";

import * as React from "react";
import Link from "next/link";
import { BarChart3, CalendarDays, CircleAlert, GraduationCap, Loader2, Lock, Power, PowerOff, Tags, UserMinus, Users, FileDown } from "lucide-react";

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

/** Zona que se ve pero no se usa sin plan: atenuada, sin clics, con su candado. */
function LockedArea({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("relative", className)}>
      <div aria-disabled className="pointer-events-none opacity-45 select-none">
        {children}
      </div>
      <Link
        href="/app/dashboard/billing"
        className="absolute top-1/2 left-1/2 inline-flex -translate-x-1/2 -translate-y-1/2 items-center gap-1.5 rounded-full border border-gold/50 bg-background/90 px-3 py-1 text-xs font-semibold whitespace-nowrap text-gold shadow-lg backdrop-blur hover:bg-gold/10"
      >
        <Lock className="size-3" aria-hidden /> {label}
      </Link>
    </div>
  );
}

const dateLong = (iso: string) => new Date(iso).toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" });

/** Ficha completa del estudiante del padre sin plan: datos, prueba gratis, avance y lo que desbloquea el plan. */
function StudentSpotlight({ student, pulse, locked }: { student: TutorStudent; pulse: Pulse | undefined; locked: boolean }) {
  if (locked) {
    return (
      <LockedArea label="Amplía tu plan para verlo">
        <div className="flex items-center gap-3 rounded-2xl border bg-card p-5">
          <Avatar name={student.alias} />
          <StudentName student={student} />
        </div>
      </LockedArea>
    );
  }

  return (
    <article className="grid gap-5 rounded-2xl border bg-card p-5 sm:p-6 lg:grid-cols-[1.2fr_1fr]">
      <div className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <Avatar name={student.alias} />
            <StudentName student={student} />
          </div>
          <AccessBadge access={student.access} />
        </div>

        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          <Datum icon={GraduationCap} label="Meta">
            {student.career ? `${student.university ? `${student.university} · ` : ""}${student.career}` : "Sin carrera elegida"}
          </Datum>
          <Datum icon={CalendarDays} label="Se registró">
            {student.registeredAt ? dateLong(student.registeredAt) : "—"}
          </Datum>
        </dl>

        <TrialMeter student={student} />
        <StudentPulse pulse={pulse} />

        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={`/app/dashboard/analytics?alumno=${student.id}`}>
              <BarChart3 /> Ver sus exámenes
            </Link>
          </Button>
          <ActivateWithPlan label="Activar su acceso ilimitado" />
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 rounded-xl border border-dashed border-gold/40 bg-gold/5 p-4">
          <div className="flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-gold/15 text-gold">
              <CalendarDays className="size-5" aria-hidden />
            </span>
            <div className="min-w-0">
              <h3 className="font-bold">Programa su plan de exámenes</h3>
              <p className="text-sm text-muted-foreground text-pretty">
                Elige la fecha de su examen de admisión, los días de práctica y el nivel: le armamos su calendario y tú
                ves si cumple cada día.
              </p>
            </div>
          </div>
          <Button variant="outline" disabled className="w-full">
            <Lock /> Programar plan
          </Button>
          <ActivateWithPlan className="w-full" label="Actívalo con tu plan" />
        </div>

        <LockedArea label="Grupos · Activa con tu plan">
          <div className="flex items-center gap-2 rounded-xl border p-3 text-sm">
            <Tags className="size-4 text-muted-foreground" aria-hidden />
            <span className="flex-1 text-muted-foreground">Grupo</span>
            <span className="rounded-md border px-3 py-1.5 text-muted-foreground">Sin grupo</span>
          </div>
        </LockedArea>
        <LockedArea label="Reportes PDF · Activa con tu plan">
          <div className="flex items-center gap-2 rounded-xl border p-3 text-sm">
            <FileDown className="size-4 text-muted-foreground" aria-hidden />
            <span className="flex-1 text-muted-foreground">Reporte en PDF para compartir</span>
          </div>
        </LockedArea>
      </div>
    </article>
  );
}

function Avatar({ name }: { name: string }) {
  return (
    <span className="grid size-12 shrink-0 place-items-center rounded-full bg-brand-gradient font-display text-lg font-bold text-white">
      {name.trim().charAt(0).toUpperCase() || "?"}
    </span>
  );
}

function Datum({ icon: Icon, label, children }: { icon: typeof Users; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5 rounded-lg bg-muted/50 px-3 py-2">
      <Icon className="size-4 shrink-0 text-brand-light" aria-hidden />
      <div className="min-w-0">
        <dt className="text-xs text-muted-foreground">{label}</dt>
        <dd className="truncate font-medium">{children}</dd>
      </div>
    </div>
  );
}
