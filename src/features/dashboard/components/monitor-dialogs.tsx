"use client";

import * as React from "react";
import { CalendarCheck, Check, FlaskConical, GraduationCap, Plus } from "lucide-react";

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
import { UNIVERSITIES } from "@/features/registro/data/catalog";
import { cn } from "@/lib/utils";

import { buildPlan, type StudentGoal } from "../lib/tutor-sample";
import type { TutorExam, TutorStudent } from "../services/tutor-service";
import { ExamSummary } from "./free-exams";
import { examAccuracy, wrongOf } from "./student-bits";
import { useTutor } from "./tutor-context";

/** Aviso del prototipo: lo que se hace en estos diálogos se ve en el panel, pero aún no se guarda. */
function PrototypeNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex gap-2 rounded-lg border border-dashed border-gold/50 bg-gold/5 px-3 py-2 text-xs text-cool">
      <FlaskConical className="mt-0.5 size-3.5 shrink-0 text-gold" aria-hidden />
      <span>{children}</span>
    </p>
  );
}

/** "Agregar otra carrera/escuela": universidad y carrera del catálogo. */
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
  const { addGoal } = useTutor();
  const [uni, setUni] = React.useState(UNIVERSITIES[0].id);
  const [career, setCareer] = React.useState<string | null>(null);
  const university = UNIVERSITIES.find((u) => u.id === uni)!;
  const taken = new Set(goals.map((g) => `${g.university}|${g.career}`));

  React.useEffect(() => {
    if (open) setCareer(null);
  }, [open]);

  const save = () => {
    const c = university.careers.find((x) => x.id === career);
    if (!c) return;
    addGoal(student.id, { careerId: c.id, career: c.name, universityId: university.id, university: university.short, main: false });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Agregar otra carrera o escuela</DialogTitle>
          <DialogDescription>
            ¿A qué otra opción aspira {student.alias}? Sus planes y estadísticas podrán separarse por cada meta.
          </DialogDescription>
        </DialogHeader>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-semibold">Universidad</legend>
          <div className="flex flex-wrap gap-2">
            {UNIVERSITIES.map((u) => (
              <button
                key={u.id}
                type="button"
                aria-pressed={u.id === uni}
                onClick={() => {
                  setUni(u.id);
                  setCareer(null);
                }}
                className={cn(
                  "rounded-xl p-1 ring-2 transition-all focus-visible:ring-ring/60 focus-visible:outline-none",
                  u.id === uni ? "ring-secondary" : "ring-transparent opacity-70 hover:opacity-100"
                )}
              >
                <UniversityBadge id={u.id} label={u.short} size="sm" />
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">{university.name}</p>
        </fieldset>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-semibold">Carrera</legend>
          <ul className="flex max-h-60 flex-col gap-1.5 overflow-y-auto">
            {university.careers.map((c) => {
              const already = taken.has(`${university.short}|${c.name}`);
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
                    <span className="flex-1">{c.name}</span>
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

        <PrototypeNote>Vista previa: la meta aparece en su ficha, pero todavía no se guarda en su perfil.</PrototypeNote>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button variant="brand" disabled={!career} onClick={save}>
            <Plus /> Agregar meta
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
}: {
  student: TutorStudent;
  goals: StudentGoal[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { addPlan } = useTutor();
  const today = todayISO();
  const [goal, setGoal] = React.useState(0);
  const [official, setOfficial] = React.useState(addDays(today, 60));
  const [days, setDays] = React.useState<DayKey[]>(["monday", "wednesday", "friday"]);
  const [perDay, setPerDay] = React.useState(1);
  const [slot, setSlot] = React.useState("16:00-18:00");

  React.useEffect(() => {
    if (!open) return;
    setGoal(0);
    setOfficial(addDays(todayISO(), 60));
  }, [open]);

  const left = daysBetween(today, official);
  const valid = goals.length > 0 && left > 0 && days.length > 0;
  const total = valid ? practiceDates(official, days, today).length * perDay : 0;
  const rec = left > 0 ? recomendacionPorDia(left) : null;

  const toggleDay = (d: DayKey) => setDays((xs) => (xs.includes(d) ? xs.filter((x) => x !== d) : [...xs, d]));

  const save = () => {
    if (!valid) return;
    addPlan(
      student.id,
      buildPlan({ id: -(Date.now() % 1_000_000), goal: goals[goal], created: today, official, days, perDay, window: slot })
    );
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Programar plan de {student.alias}</DialogTitle>
          <DialogDescription>Le armamos su calendario de exámenes hasta el día de su examen de admisión.</DialogDescription>
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

        <PrototypeNote>Vista previa: el plan aparece en tu panel, pero todavía no se envía a {student.alias}.</PrototypeNote>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button variant="brand" disabled={!valid} onClick={save}>
            <CalendarCheck /> Programar plan
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

const dateFmt = new Intl.DateTimeFormat("es-MX", { dateStyle: "long", timeStyle: "short" });

/** Resultados de un examen: el reporte completo con su guía (exámenes reales) o el resumen por materia (ejemplo). */
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
            {exam.id > 0 ? (
              <ExamSummary examId={exam.id} demo={false} />
            ) : (
              <div className="flex flex-col gap-4">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <p className="text-sm text-muted-foreground">{dateFmt.format(new Date(exam.completedAt))}</p>
                  <p className="font-display text-4xl font-bold tabular-nums">
                    {examAccuracy(exam)}%<span className="ml-2 text-sm font-medium text-muted-foreground">de aciertos</span>
                  </p>
                </div>
                <p className="text-sm text-cool">
                  {exam.totalQuestions} preguntas · <strong className="text-foreground">{wrongOf(exam)}</strong> mal contestadas
                </p>
                <ul className="flex flex-col gap-2">
                  {exam.materias.map((m) => {
                    const pct = m.total ? Math.round((100 * m.correctas) / m.total) : 0;
                    return (
                      <li key={m.materia} className="grid grid-cols-[8rem_1fr_3rem] items-center gap-3 text-sm">
                        <span className="truncate">{m.materia}</span>
                        <span className="h-2 overflow-hidden rounded-full bg-muted">
                          <span className="block h-full rounded-full bg-secondary" style={{ width: `${pct}%` }} />
                        </span>
                        <span className="text-right font-semibold tabular-nums">{pct}%</span>
                      </li>
                    );
                  })}
                </ul>
                <PrototypeNote>Examen de ejemplo: en uno real aquí aparece su guía de estudio con cada pregunta.</PrototypeNote>
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
