"use client";

import * as React from "react";
import { CalendarCheck, Check, CircleAlert, GraduationCap, Loader2, Plus } from "lucide-react";

import { UniversityBadge } from "@/components/layout/university-badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  addDays,
  daysBetween,
  DIAS,
  type DayKey,
  formatFull,
  HORARIOS,
  MAX_POR_DIA,
  practiceDates,
  recomendacionPorDia,
  todayISO,
} from "@/features/plan/lib/plan";
import { getCatalogo } from "@/features/escuelas/services/catalogo-service";
import type { Institucion } from "@/features/escuelas/types";
import { cn } from "@/lib/utils";

import {
  addStudentGoal,
  createStudentPlan,
  errorMessage,
  type StudentGoal,
  type TutorExam,
  type TutorStudent,
} from "../services/tutor-service";
import { ExamSummary } from "./free-exams";
import { useTutor } from "./tutor-context";

function FormError({ text }: { text: string }) {
  if (!text) return null;
  return (
    <p role="alert" className="flex items-center gap-2 text-sm text-destructive">
      <CircleAlert className="size-4 shrink-0" /> {text}
    </p>
  );
}

/** "Agregar otra carrera/escuela": universidad y carrera del catálogo oficial; se guarda en sus metas. */
export function AddGoalDialog({
  student,
  goals,
  open,
  onOpenChange,
}: {
  student: TutorStudent;
  goals: StudentGoal[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { reload } = useTutor();
  const [catalog, setCatalog] = React.useState<Institucion[] | null>(null);
  const [uni, setUni] = React.useState<string | null>(null);
  const [career, setCareer] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    if (!open) return;
    setCareer(null);
    setError("");
    if (catalog) return;
    getCatalogo()
      .then((c) => {
        const active = c.filter((i) => i.activo && i.carreras.some((x) => x.activo));
        setCatalog(active);
        setUni((u) => u ?? goals[0]?.universityId ?? active[0]?.id ?? null);
      })
      .catch(() => setError("No pudimos cargar el catálogo de carreras."));
  }, [open, catalog, goals]);

  const university = catalog?.find((u) => u.id === uni) ?? null;
  const taken = new Set(goals.map((g) => g.careerId));

  const save = async () => {
    if (!career) return;
    setSaving(true);
    setError("");
    try {
      await addStudentGoal(student.id, career);
      await reload();
      onOpenChange(false);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Agregar otra carrera o escuela</DialogTitle>
          <DialogDescription>
            ¿A qué otra opción aspira {student.alias}? Se agrega a sus metas y podrás programarle un plan para ella.
          </DialogDescription>
        </DialogHeader>

        {!catalog ? (
          error ? (
            <FormError text={error} />
          ) : (
            <div className="grid min-h-40 place-items-center" role="status" aria-label="Cargando catálogo">
              <Loader2 className="size-6 animate-spin text-brand-light motion-reduce:animate-none" />
            </div>
          )
        ) : (
          <>
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-2 text-sm font-semibold">Universidad</legend>
              <div className="flex flex-wrap gap-2">
                {catalog.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    aria-pressed={u.id === uni}
                    aria-label={u.nombre}
                    onClick={() => {
                      setUni(u.id);
                      setCareer(null);
                    }}
                    className={cn(
                      "rounded-xl p-1 ring-2 transition-all focus-visible:ring-ring/60 focus-visible:outline-none",
                      u.id === uni ? "ring-secondary" : "ring-transparent opacity-70 hover:opacity-100"
                    )}
                  >
                    <UniversityBadge id={u.id} label={u.clave} size="sm" />
                  </button>
                ))}
              </div>
              {university && <p className="text-xs text-muted-foreground">{university.nombre}</p>}
            </fieldset>

            {university && (
              <fieldset className="flex flex-col gap-2">
                <legend className="mb-2 text-sm font-semibold">Carrera</legend>
                <ul className="flex max-h-60 flex-col gap-1.5 overflow-y-auto">
                  {university.carreras
                    .filter((c) => c.activo)
                    .map((c) => {
                      const already = taken.has(c.id);
                      const active = career === c.id;
                      return (
                        <li key={c.id}>
                          <button
                            type="button"
                            disabled={already}
                            aria-pressed={active}
                            onClick={() => setCareer(c.id)}
                            className={cn(
                              "flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none disabled:opacity-50",
                              active ? "border-secondary/60 bg-secondary/10" : "hover:bg-accent"
                            )}
                          >
                            <GraduationCap className="size-4 shrink-0 text-brand-light" aria-hidden />
                            <span className="flex-1">{c.nombre}</span>
                            {already ? (
                              <span className="text-xs text-muted-foreground">Ya es su meta</span>
                            ) : (
                              active && <Check className="size-4 text-secondary" aria-hidden />
                            )}
                          </button>
                        </li>
                      );
                    })}
                </ul>
              </fieldset>
            )}
            <FormError text={error} />
          </>
        )}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button variant="brand" disabled={!career || saving} onClick={save}>
            {saving ? <Loader2 className="animate-spin" /> : <Plus />} Agregar meta
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** "Crear nuevo plan" para el estudiante: meta, fecha del examen, días, exámenes por día y horario. */
export function CreatePlanDialog({
  student,
  goals,
  open,
  onOpenChange,
  onCreated,
}: {
  student: TutorStudent;
  goals: StudentGoal[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}) {
  const today = todayISO();
  const [goal, setGoal] = React.useState(0);
  const [official, setOfficial] = React.useState(addDays(today, 60));
  const [days, setDays] = React.useState<DayKey[]>(["monday", "wednesday", "friday"]);
  const [perDay, setPerDay] = React.useState(1);
  const [slot, setSlot] = React.useState("16:00-18:00");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    if (!open) return;
    setGoal(0);
    setOfficial(addDays(todayISO(), 60));
    setError("");
  }, [open]);

  const left = daysBetween(today, official);
  const valid = goals.length > 0 && left > 0 && days.length > 0;
  const total = valid ? practiceDates(official, days, today).length * perDay : 0;
  const rec = left > 0 ? recomendacionPorDia(left) : null;

  const toggleDay = (d: DayKey) => setDays((xs) => (xs.includes(d) ? xs.filter((x) => x !== d) : [...xs, d]));

  const save = async () => {
    if (!valid) return;
    setSaving(true);
    setError("");
    try {
      await createStudentPlan(student.id, {
        careerId: goals[goal].careerId,
        officialDate: official,
        practiceDays: DIAS.filter((d) => days.includes(d.key)).map((d) => d.key),
        examsPerDay: perDay,
        difficultyMode: "automatic",
        fixedLevel: null,
        timeWindow: slot,
      });
      onCreated();
      onOpenChange(false);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Programar plan de {student.alias}</DialogTitle>
          <DialogDescription>
            Le armamos su calendario de exámenes hasta el día de su examen de admisión; {student.alias} lo verá en su app.
          </DialogDescription>
        </DialogHeader>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-semibold">Meta</legend>
          <div className="flex flex-col gap-1.5">
            {goals.map((g, i) => (
              <button
                key={g.careerId}
                type="button"
                aria-pressed={goal === i}
                onClick={() => setGoal(i)}
                className={cn(
                  "flex items-center gap-3 rounded-lg border px-3 py-2 text-left text-sm transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
                  goal === i ? "border-secondary/60 bg-secondary/10" : "hover:bg-accent"
                )}
              >
                <UniversityBadge id={g.universityId} label={g.university} size="sm" />
                <span className="flex-1 font-medium">{g.career}</span>
                {goal === i && <Check className="size-4 text-secondary" aria-hidden />}
              </button>
            ))}
          </div>
        </fieldset>

        <label className="flex flex-col gap-2 text-sm font-semibold">
          Fecha de su examen de admisión
          <Input type="date" value={official} min={addDays(today, 1)} onChange={(e) => setOfficial(e.target.value)} />
          {left > 0 && <span className="text-xs font-normal text-muted-foreground">Faltan {left} días · {formatFull(official)}</span>}
        </label>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-semibold">Días de práctica</legend>
          <div className="grid grid-cols-7 gap-1.5">
            {DIAS.map((d) => {
              const on = days.includes(d.key);
              return (
                <button
                  key={d.key}
                  type="button"
                  aria-pressed={on}
                  aria-label={d.nombre}
                  onClick={() => toggleDay(d.key)}
                  className={cn(
                    "h-10 rounded-lg border text-sm font-semibold transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
                    on ? "border-secondary/60 bg-secondary/15 text-secondary" : "text-muted-foreground hover:bg-accent"
                  )}
                >
                  {d.corto}
                </button>
              );
            })}
          </div>
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-2">
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-sm font-semibold">Exámenes por día</legend>
            <div className="flex gap-1.5">
              {Array.from({ length: MAX_POR_DIA }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  type="button"
                  aria-pressed={perDay === n}
                  onClick={() => setPerDay(n)}
                  className={cn(
                    "h-10 flex-1 rounded-lg border font-semibold tabular-nums transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
                    perDay === n ? "border-secondary/60 bg-secondary/15 text-secondary" : "text-muted-foreground hover:bg-accent"
                  )}
                >
                  {n}
                </button>
              ))}
            </div>
            {rec && (
              <span className="text-xs text-muted-foreground">
                Recomendado: {rec.porDia} al día{rec.urgencia === "urgente" ? " (¡ya está cerca!)" : ""}
              </span>
            )}
          </fieldset>
          <label className="flex flex-col gap-2 text-sm font-semibold">
            Horario
            <select
              value={slot}
              onChange={(e) => setSlot(e.target.value)}
              className="h-11 rounded-md border bg-background/60 px-3 text-sm font-normal focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
            >
              {HORARIOS.map((h) => (
                <option key={h.value} value={h.value}>
                  {h.nombre}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="flex items-center gap-3 rounded-xl bg-muted/50 p-3">
          <CalendarCheck className="size-5 shrink-0 text-secondary" aria-hidden />
          <p className="text-sm text-cool">
            {valid ? (
              <>
                <strong className="text-foreground tabular-nums">{total} exámenes</strong> de hoy al día de su examen. La
                dificultad se ajusta sola según cómo le vaya.
              </>
            ) : (
              "Elige la fecha y al menos un día de práctica."
            )}
          </p>
        </div>

        <FormError text={error} />

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button variant="brand" disabled={!valid || saving} onClick={save}>
            {saving ? <Loader2 className="animate-spin" /> : <CalendarCheck />} Programar plan
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Resultados de un examen: resumen, guía de errores y el acceso al examen completo. */
export function ExamResultsDialog({ exam, onOpenChange }: { exam: TutorExam | null; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={!!exam} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        {exam && (
          <>
            <DialogHeader>
              <DialogTitle>Resultados del examen</DialogTitle>
              <DialogDescription>
                {exam.universityKey} · {exam.careerName}
              </DialogDescription>
            </DialogHeader>
            <ExamSummary examId={exam.id} demo={false} />
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
