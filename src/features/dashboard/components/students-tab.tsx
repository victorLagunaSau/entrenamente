"use client";

import * as React from "react";
import Link from "next/link";
import { BarChart3, CircleAlert, CreditCard, Loader2, Power, PowerOff, UserMinus, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

import { planName, TUTOR_COPY } from "../lib/tutor-plans";
import { activateSeat, errorMessage, releaseSeat, unlinkStudent, type TutorStudent } from "../services/tutor-service";
import { GroupChips, GroupSelect, type GroupFilter } from "./groups";
import { InviteButton } from "./invite-dialog";
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

  if (!license) {
    return (
      <section className="flex flex-col gap-4 rounded-2xl border border-gold/30 bg-gold/5 p-5 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h2 className="font-bold">Aún no tienes un plan activo</h2>
          <p className="text-sm text-muted-foreground text-pretty">
            Puedes invitar desde ahora; tus estudiantes tendrán acceso ilimitado en cuanto actives tu plan.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href="/app/dashboard/billing">
              <CreditCard /> Ver planes
            </Link>
          </Button>
          <InviteButton />
        </div>
      </section>
    );
  }

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

function StudentsList() {
  const { kind, panel } = useTutor();
  const [filter, setFilter] = React.useState<GroupFilter>("all");
  const students = panel!.students;
  // Si se borra el grupo que se estaba filtrando, se vuelve a "Todos".
  const activeFilter = typeof filter === "number" && !panel!.groups.some((g) => g.id === filter) ? "all" : filter;
  const visible = students.filter((s) =>
    activeFilter === "all" ? true : activeFilter === "none" ? s.groupId === null : s.groupId === activeFilter
  );

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
                    <td className="px-4 py-3">
                      <GroupSelect studentId={s.id} groupId={s.groupId} label={`Grupo de ${s.alias}`} />
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge active={s.active} />
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
                  <StatusBadge active={s.active} />
                </div>
                <StudentGoal student={s} />
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

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap",
        active ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"
      )}
    >
      <span className={cn("size-1.5 rounded-full", active ? "bg-success" : "bg-muted-foreground")} aria-hidden />
      {active ? "Activo" : "Inactivo"}
    </span>
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
        ) : (
          canActivate && (
            <Button variant="ghost" size="sm" disabled={busy} onClick={() => run(() => activateSeat(student.id))}>
              {busy ? <Loader2 className="animate-spin" /> : <Power />} Activar
            </Button>
          )
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
