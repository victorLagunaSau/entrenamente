"use client";

import * as React from "react";
import { ArrowLeft, ArrowRight, CalendarDays, CircleAlert, Clock, Gauge, Info, Loader2, Repeat, School, Sparkles, SlidersHorizontal } from "lucide-react";

import { UniversityBadge } from "@/components/layout/university-badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { NIVELES, type Nivel } from "@/features/exam/lib/libre";
import { getDisponibles } from "@/features/exam/services/libre-service";
import type { StudentCareer } from "@/features/student/services/student-careers-service";
import { cn } from "@/lib/utils";

import {
  addDays,
  daysBetween,
  DIAS,
  type DayKey,
  formatFull,
  formatLong,
  formatWindow,
  HORARIOS,
  MAX_DIAS_PLAN,
  MAX_POR_DIA,
  type PlanDraft,
  PLAN_BAJO,
  practiceDates,
  todayISO,
} from "../lib/plan";
import { crearPlan } from "../services/plan-service";

const STEPS = [
  { title: "Carrera", icon: School },
  { title: "Fecha del examen oficial", icon: CalendarDays },
  { title: "Días de práctica", icon: Repeat },
  { title: "Exámenes por día", icon: Gauge },
  { title: "Dificultad", icon: SlidersHorizontal },
  { title: "Horario preferido", icon: Clock },
] as const;

const PRESETS: { nombre: string; dias: DayKey[] }[] = [
  { nombre: "L · M · V", dias: ["monday", "wednesday", "friday"] },
  { nombre: "Entre semana", dias: ["monday", "tuesday", "wednesday", "thursday", "friday"] },
  { nombre: "Todos", dias: DIAS.map((d) => d.key) },
];

type Draft = Omit<PlanDraft, "careerId"> & { careerId: string | null };

const initialDraft = (careers: StudentCareer[]): Draft => ({
  careerId: careers.length === 1 ? careers[0].id : null,
  officialDate: "",
  practiceDays: ["monday", "wednesday", "friday"],
  examsPerDay: 1,
  difficultyMode: "automatic",
  fixedLevel: null,
  timeWindow: "16:00-18:00",
});

/**
 * Wizard "Crear plan personalizado": 6 pasos + resumen. El calendario se calcula aquí solo como vista previa;
 * el definitivo lo arma la base (crear_plan) con la misma regla.
 * `careers` = carreras del perfil que aún no tienen plan activo.
 */
export function PlanWizard({
  open,
  onOpenChange,
  careers,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  careers: StudentCareer[];
  onCreated: (planId: number) => void;
}) {
  const [step, setStep] = React.useState(0);
  const [draft, setDraft] = React.useState<Draft>(() => initialDraft(careers));
  const [disponibles, setDisponibles] = React.useState<Map<string, number> | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Cada vez que se abre, empieza de cero.
  React.useEffect(() => {
    if (!open) return;
    setStep(0);
    setDraft(initialDraft(careers));
    setError(null);
    getDisponibles()
      .then((m) => setDisponibles(new Map([...m].map(([id, c]) => [id, c.facil + c.media + c.dificil]))))
      .catch(() => setDisponibles(new Map()));
  }, [open, careers]);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value }));

  const today = todayISO();
  const dates = draft.officialDate ? practiceDates(draft.officialDate, draft.practiceDays, today) : [];
  const totalExams = dates.length * draft.examsPerDay;
  const summaryStep = STEPS.length;

  const valid = [
    draft.careerId !== null,
    draft.officialDate > today && daysBetween(today, draft.officialDate) <= MAX_DIAS_PLAN,
    draft.practiceDays.length > 0 && dates.length > 0,
    draft.examsPerDay >= 1 && draft.examsPerDay <= MAX_POR_DIA,
    draft.difficultyMode === "automatic" || draft.fixedLevel !== null,
    /^\d{2}:\d{2}-\d{2}:\d{2}$/.test(draft.timeWindow) && draft.timeWindow.slice(0, 5) < draft.timeWindow.slice(6),
  ];

  const create = async () => {
    if (!draft.careerId) return;
    setSaving(true);
    setError(null);
    try {
      const id = await crearPlan({ ...draft, careerId: draft.careerId });
      onCreated(id);
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No pudimos crear tu plan.");
    } finally {
      setSaving(false);
    }
  };

  const StepIcon = step < summaryStep ? STEPS[step].icon : Sparkles;

  return (
    <Dialog open={open} onOpenChange={(o) => !saving && onOpenChange(o)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
            {step < summaryStep ? `Paso ${step + 1} de ${STEPS.length}` : "Resumen"}
          </p>
          <DialogTitle className="flex items-center gap-2">
            <StepIcon className="size-5 text-brand-light" aria-hidden />
            {step < summaryStep ? STEPS[step].title : "Tu plan personalizado"}
          </DialogTitle>
          <DialogDescription className="sr-only">Crear plan personalizado de exámenes</DialogDescription>
          <div className="mt-1 grid grid-cols-7 gap-1" aria-hidden>
            {[...STEPS, null].map((_, i) => (
              <span key={i} className={cn("h-1 rounded-full", i <= step ? "bg-brand-gradient" : "bg-muted")} />
            ))}
          </div>
        </DialogHeader>

        <div className="min-h-64">
          {step === 0 && (
            <CareerStep careers={careers} disponibles={disponibles} value={draft.careerId} onChange={(v) => set("careerId", v)} />
          )}
          {step === 1 && <DateStep today={today} value={draft.officialDate} onChange={(v) => set("officialDate", v)} />}
          {step === 2 && (
            <DaysStep value={draft.practiceDays} onChange={(v) => set("practiceDays", v)} count={dates.length} officialDate={draft.officialDate} />
          )}
          {step === 3 && <PerDayStep value={draft.examsPerDay} onChange={(v) => set("examsPerDay", v)} total={totalExams} />}
          {step === 4 && (
            <DifficultyStep
              mode={draft.difficultyMode}
              level={draft.fixedLevel}
              onChange={(mode, level) => setDraft((d) => ({ ...d, difficultyMode: mode, fixedLevel: level }))}
            />
          )}
          {step === 5 && <WindowStep value={draft.timeWindow} onChange={(v) => set("timeWindow", v)} />}
          {step === summaryStep && <Summary draft={draft} careers={careers} dates={dates} total={totalExams} />}
        </div>

        {error && (
          <p role="alert" className="flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            <CircleAlert className="mt-0.5 size-4 shrink-0" /> {error}
          </p>
        )}

        <div className="flex items-center justify-between gap-2">
          <Button variant="ghost" onClick={() => setStep((s) => s - 1)} disabled={step === 0 || saving} className={cn(step === 0 && "invisible")}>
            <ArrowLeft /> Atrás
          </Button>
          {step < summaryStep ? (
            <Button onClick={() => setStep((s) => s + 1)} disabled={!valid[step]}>
              Siguiente <ArrowRight />
            </Button>
          ) : (
            <Button variant="brand" onClick={create} disabled={saving || !valid.every(Boolean)}>
              {saving ? <Loader2 className="animate-spin motion-reduce:animate-none" /> : <Sparkles />} Crear plan
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ─────────────────────────── Pasos ─────────────────────────── */

const optionCard =
  "flex w-full items-center gap-3 rounded-xl border bg-background/40 p-3 text-left transition-colors outline-none hover:border-foreground/30 focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-checked:border-secondary aria-checked:bg-secondary/10 disabled:pointer-events-none disabled:opacity-50";

function Hint({ children, icon: Icon = Info }: { children: React.ReactNode; icon?: typeof Info }) {
  return (
    <p className="flex items-start gap-2 rounded-xl bg-muted/50 p-3 text-sm text-muted-foreground text-pretty">
      <Icon className="mt-0.5 size-4 shrink-0 text-brand-light" aria-hidden /> <span>{children}</span>
    </p>
  );
}

function CareerStep({
  careers,
  disponibles,
  value,
  onChange,
}: {
  careers: StudentCareer[];
  disponibles: Map<string, number> | null;
  value: string | null;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">Elige una de las carreras de tu perfil que aún no tiene plan.</p>
      <div role="radiogroup" aria-label="Carrera" className="flex flex-col gap-2">
        {careers.map((c) => {
          const count = disponibles?.get(c.id) ?? null;
          const empty = disponibles !== null && !count;
          return (
            <button key={c.id} type="button" role="radio" aria-checked={value === c.id} disabled={empty} onClick={() => onChange(c.id)} className={optionCard}>
              <UniversityBadge id={c.universityId} label={c.universityShort} size="sm" />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate font-semibold">{c.name}</span>
                <span className="text-xs text-muted-foreground">
                  {disponibles === null ? "Revisando preguntas…" : empty ? "Aún sin preguntas en el banco" : `${count} preguntas disponibles`}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function DateStep({ today, value, onChange }: { today: string; value: string; onChange: (v: string) => void }) {
  const days = value ? daysBetween(today, value) : null;
  const tooFar = days !== null && days > MAX_DIAS_PLAN;
  return (
    <div className="flex flex-col gap-4">
      <label className="flex flex-col gap-2 text-sm font-medium">
        ¿Qué día presentas tu examen de admisión?
        <input
          type="date"
          value={value}
          min={addDays(today, 1)}
          max={addDays(today, MAX_DIAS_PLAN)}
          onChange={(e) => onChange(e.target.value)}
          className="h-12 rounded-lg border border-input bg-background px-3 text-base [color-scheme:dark] outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        />
      </label>
      {days !== null && days > 0 && !tooFar && (
        <div className="grid grid-cols-2 gap-2 text-center">
          <Big value={days} label={days === 1 ? "día disponible" : "días disponibles"} />
          <Big value={Math.floor(days / 7)} label={Math.floor(days / 7) === 1 ? "semana" : "semanas"} />
          <p className="col-span-2 text-xs text-muted-foreground">Examen oficial: {formatLong(value)} de {value.slice(0, 4)}.</p>
        </div>
      )}
      {days !== null && days <= 0 && <Hint icon={CircleAlert}>Elige una fecha posterior a hoy.</Hint>}
      {tooFar && <Hint icon={CircleAlert}>El plan puede cubrir hasta 18 meses. Elige una fecha más cercana.</Hint>}
    </div>
  );
}

function Big({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-xl border bg-background/40 p-3">
      <p className="font-display text-3xl font-bold text-secondary">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function DaysStep({ value, onChange, count, officialDate }: { value: DayKey[]; onChange: (v: DayKey[]) => void; count: number; officialDate: string }) {
  const toggle = (k: DayKey) => onChange(value.includes(k) ? value.filter((d) => d !== k) : [...value, k]);
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">Toca los días de la semana en que vas a practicar.</p>
      <div className="grid grid-cols-7 gap-1.5" role="group" aria-label="Días de práctica">
        {DIAS.map((d) => {
          const on = value.includes(d.key);
          return (
            <button
              key={d.key}
              type="button"
              aria-pressed={on}
              aria-label={d.nombre}
              onClick={() => toggle(d.key)}
              className={cn(
                "grid aspect-square place-items-center rounded-xl border font-display text-lg font-bold transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
                on ? "border-secondary bg-secondary text-secondary-foreground" : "bg-background/40 text-muted-foreground hover:border-foreground/30"
              )}
            >
              {d.corto}
            </button>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <Button key={p.nombre} variant="outline" size="sm" onClick={() => onChange(p.dias)}>
            {p.nombre}
          </Button>
        ))}
      </div>
      {value.length > 0 && officialDate && (
        <Hint icon={CalendarDays}>
          {count > 0 ? (
            <>
              Tendrás <strong className="text-foreground">{count} días de práctica</strong> antes de tu examen.
            </>
          ) : (
            "No queda ninguno de esos días antes de tu examen. Agrega más días."
          )}
        </Hint>
      )}
    </div>
  );
}

function PerDayStep({ value, onChange, total }: { value: number; onChange: (v: number) => void; total: number }) {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">¿Cuántos exámenes harás cada día de práctica?</p>
      <div role="radiogroup" aria-label="Exámenes por día" className="grid grid-cols-3 gap-2">
        {Array.from({ length: MAX_POR_DIA }, (_, i) => i + 1).map((n) => (
          <button key={n} type="button" role="radio" aria-checked={value === n} onClick={() => onChange(n)} className={cn(optionCard, "flex-col gap-0.5 text-center")}>
            <span className="font-display text-2xl font-bold">{n}</span>
            <span className="text-xs text-muted-foreground">{n === 1 ? "Recomendado" : "por día"}</span>
          </button>
        ))}
      </div>
      <p className="text-sm">
        Total del plan: <strong className="text-secondary">{total} exámenes</strong>
      </p>
      <Hint icon={Repeat}>
        Si tu rendimiento baja en algún examen (menos de {PLAN_BAJO}{"\u00a0"}%), el sistema te sugerirá temporalmente un examen de refuerzo doble
        para recuperar el nivel.
      </Hint>
    </div>
  );
}

function DifficultyStep({ mode, level, onChange }: { mode: PlanDraft["difficultyMode"]; level: Nivel | null; onChange: (m: PlanDraft["difficultyMode"], l: Nivel | null) => void }) {
  return (
    <div className="flex flex-col gap-3">
      <div role="radiogroup" aria-label="Tipo de dificultad" className="flex flex-col gap-2">
        <button type="button" role="radio" aria-checked={mode === "automatic"} onClick={() => onChange("automatic", null)} className={cn(optionCard, "items-start")}>
          <Sparkles className="mt-0.5 size-5 shrink-0 text-secondary" aria-hidden />
          <span className="flex flex-col gap-0.5">
            <span className="font-semibold">Automática (recomendada)</span>
            <span className="text-xs text-muted-foreground text-pretty">
              Empieza en nivel medio y se ajusta con tu examen anterior: si sacas 85{"\u00a0"}% o más sube, si bajas de {PLAN_BAJO}{"\u00a0"}% refuerza con un
              nivel más fácil.
            </span>
          </span>
        </button>
        <button type="button" role="radio" aria-checked={mode === "fixed"} onClick={() => onChange("fixed", level ?? "media")} className={cn(optionCard, "items-start")}>
          <SlidersHorizontal className="mt-0.5 size-5 shrink-0 text-brand-light" aria-hidden />
          <span className="flex flex-col gap-0.5">
            <span className="font-semibold">Personalizada</span>
            <span className="text-xs text-muted-foreground">Tú fijas un nivel para todo el plan.</span>
          </span>
        </button>
      </div>
      {mode === "fixed" && (
        <div role="radiogroup" aria-label="Nivel fijo" className="grid grid-cols-3 gap-2">
          {NIVELES.map((n) => (
            <button key={n.value} type="button" role="radio" aria-checked={level === n.value} onClick={() => onChange("fixed", n.value)} className={cn(optionCard, "flex-col gap-0.5 text-center")}>
              <span className="font-semibold">{n.nombre}</span>
              <span className="font-mono text-[11px] text-muted-foreground">
                {n.volumen[0]}–{n.volumen[1]} preg.
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function WindowStep({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const preset = HORARIOS.some((h) => h.value === value);
  const [custom, setCustom] = React.useState(!preset);
  const [from, to] = value.split("-");
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">¿En qué horario prefieres presentar tus exámenes?</p>
      <div role="radiogroup" aria-label="Horario" className="grid grid-cols-2 gap-2">
        {HORARIOS.map((h) => (
          <button
            key={h.value}
            type="button"
            role="radio"
            aria-checked={!custom && value === h.value}
            onClick={() => {
              setCustom(false);
              onChange(h.value);
            }}
            className={cn(optionCard, "flex-col items-start gap-0.5")}
          >
            <span className="font-semibold">{h.nombre}</span>
            <span className="text-xs text-muted-foreground">{formatWindow(h.value)}</span>
          </button>
        ))}
        <button type="button" role="radio" aria-checked={custom} onClick={() => setCustom(true)} className={cn(optionCard, "col-span-2")}>
          <Clock className="size-4 text-brand-light" aria-hidden /> <span className="font-semibold">Personalizado</span>
        </button>
      </div>
      {custom && (
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              ["Desde", from, (v: string) => onChange(`${v}-${to}`)],
              ["Hasta", to, (v: string) => onChange(`${from}-${v}`)],
            ] as const
          ).map(([label, v, set]) => (
            <label key={label} className="flex flex-col gap-1 text-xs text-muted-foreground">
              {label}
              <input
                type="time"
                value={v}
                onChange={(e) => e.target.value && set(e.target.value)}
                className="h-11 rounded-lg border border-input bg-background px-3 text-base text-foreground [color-scheme:dark] outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
              />
            </label>
          ))}
          {from >= to && <p className="col-span-2 text-xs text-destructive">La hora final debe ser después de la inicial.</p>}
        </div>
      )}
      <Hint icon={Clock}>Te lo recordaremos en tu home; puedes presentar el examen del día a cualquier hora.</Hint>
    </div>
  );
}

function Summary({ draft, careers, dates, total }: { draft: Draft; careers: StudentCareer[]; dates: string[]; total: number }) {
  const career = careers.find((c) => c.id === draft.careerId);
  const nivel = NIVELES.find((n) => n.value === draft.fixedLevel)?.nombre;
  const rows: [string, React.ReactNode][] = [
    ["Carrera", career ? `${career.universityShort} · ${career.name}` : "—"],
    ["Examen oficial", draft.officialDate ? formatFull(draft.officialDate) : "—"],
    ["Días", DIAS.filter((d) => draft.practiceDays.includes(d.key)).map((d) => d.nombre).join(", ")],
    ["Por día", draft.examsPerDay === 1 ? "1 examen" : `${draft.examsPerDay} exámenes`],
    ["Dificultad", draft.difficultyMode === "automatic" ? "Automática" : `Fija · ${nivel}`],
    ["Horario", formatWindow(draft.timeWindow)],
  ];
  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl bg-brand-gradient p-4 text-white">
        <p className="font-display text-4xl font-bold">{total}</p>
        <p className="text-sm text-white/90">
          exámenes en {dates.length} días de práctica{dates[0] && <> · el primero {dates[0] === todayISO() ? "hoy" : `el ${formatLong(dates[0])}`}</>}
        </p>
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
        {rows.map(([k, v]) => (
          <React.Fragment key={k}>
            <dt className="text-muted-foreground">{k}</dt>
            <dd className="font-medium">{v}</dd>
          </React.Fragment>
        ))}
      </dl>
      <p className="text-xs text-muted-foreground">Podrás mover cualquier examen pendiente de fecha desde tu calendario.</p>
    </div>
  );
}
