"use client";

import * as React from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { CalendarCheck, CheckCircle2, CircleAlert, Dumbbell, Flame, Loader2, Lock, Pencil, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

import { cancelarPlan, guardarPlan, type ToeflEstado, type ToeflPlan } from "../services/toefl-service";

const EXAM_PATH = "/app/student/toefl/examen";
const DIAS = ["L", "M", "M", "J", "V", "S", "D"];
const DIAS_LARGO = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];

/** Avance hacia el siguiente nivel (2 simulacros seguidos con ≥ 80 % en el nivel superior). */
export function PromotionProgress({ estado }: { estado: ToeflEstado }) {
  const p = estado.promocion;
  if (!p) return null;
  return (
    <div className="flex flex-col gap-2 rounded-xl bg-muted/40 p-3 text-sm">
      <p>
        Para subir a <strong>{p.nivelSuperior}</strong>: 80 % o más en las preguntas {p.nivelSuperior} en 2 simulacros seguidos.
      </p>
      <div className="flex items-center gap-2">
        {[0, 1].map((i) => (
          <span key={i} className={cn("h-2 flex-1 rounded-full", i < p.seguidos ? "bg-secondary" : "bg-muted")} />
        ))}
        <span className="text-xs text-muted-foreground tabular-nums">{p.seguidos}/2</span>
      </div>
      {p.ultimoPct !== null && (
        <p className="text-xs text-muted-foreground">
          Último simulacro: {Math.round(p.ultimoPct)} % en {p.nivelSuperior}.
        </p>
      )}
    </div>
  );
}

/** Práctica, plan y racha. */
export function ToeflModes({ estado, onChanged }: { estado: ToeflEstado; onChanged: () => void }) {
  const blocked = !estado.accesoIlimitado ? "lock" : !estado.nivel ? "nivel" : null;

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <ModeCard
        icon={Dumbbell}
        tone="bg-primary/15 text-brand-light"
        title="Práctica libre"
        text="30–40 minutos. 60 % de tu nivel y 40 % del siguiente."
        blocked={blocked}
      >
        <Button asChild size="sm" className="self-start">
          <Link href={`${EXAM_PATH}?tipo=practica`}>Iniciar práctica</Link>
        </Button>
      </ModeCard>

      <ModeCard
        icon={Flame}
        tone="bg-energy/15 text-energy"
        title="Racha diaria"
        text="5 preguntas en 10 minutos, una vez al día."
        badge={estado.racha.diasSeguidos > 0 ? `${estado.racha.diasSeguidos} ${estado.racha.diasSeguidos === 1 ? "día" : "días"}` : undefined}
        blocked={blocked}
      >
        {estado.racha.hechaHoy ? (
          <p className="flex items-center gap-1.5 text-sm text-secondary">
            <CheckCircle2 className="size-4" /> Racha de hoy lista. Vuelve mañana.
          </p>
        ) : (
          <Button asChild size="sm" className="self-start">
            <Link href={`${EXAM_PATH}?tipo=racha`}>Jugar racha de hoy</Link>
          </Button>
        )}
      </ModeCard>

      <div className="sm:col-span-2">
        <PlanCard plan={estado.plan} blocked={blocked} onChanged={onChanged} />
      </div>
    </div>
  );
}

function ModeCard({
  icon: Icon,
  tone,
  title,
  text,
  badge,
  blocked,
  children,
}: {
  icon: LucideIcon;
  tone: string;
  title: string;
  text: string;
  badge?: string;
  blocked: "lock" | "nivel" | null;
  children: React.ReactNode;
}) {
  return (
    <section className="flex h-full flex-col gap-3 rounded-2xl border bg-card p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl", tone)}>
          <Icon className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="flex items-center gap-2 font-semibold">
            {title}
            {badge && <span className="rounded-full bg-energy/15 px-2 py-0.5 text-xs font-medium text-energy">{badge}</span>}
          </h2>
          <p className="text-sm text-muted-foreground">{text}</p>
        </div>
      </div>
      <div className="mt-auto flex flex-col">{blocked ? <Blocked kind={blocked} /> : children}</div>
    </section>
  );
}

function Blocked({ kind }: { kind: "lock" | "nivel" }) {
  if (kind === "nivel") return <p className="text-sm text-muted-foreground">Primero presenta tu diagnóstico.</p>;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Lock className="size-4" /> Parte del acceso ilimitado.
      </p>
      <Button asChild variant="outline" size="sm">
        <Link href="/pricing">Ver planes</Link>
      </Button>
    </div>
  );
}

/* ─────────────────────────── Plan ─────────────────────────── */

function PlanCard({ plan, blocked, onChanged }: { plan: ToeflPlan | null; blocked: "lock" | "nivel" | null; onChanged: () => void }) {
  const [editing, setEditing] = React.useState(false);
  const today = new Date();
  const isoToday = ((today.getDay() + 6) % 7) + 1;
  const monday = new Date(today);
  monday.setDate(today.getDate() - (isoToday - 1));
  const hechas = new Set(plan?.semana ?? []);
  const diasFaltan = plan?.examDate
    ? Math.ceil((new Date(`${plan.examDate}T00:00:00`).getTime() - new Date(today.toDateString()).getTime()) / 86400000)
    : null;

  return (
    <section className="flex flex-col gap-4 rounded-2xl border bg-card p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-secondary/15 text-secondary">
          <CalendarCheck className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold">Plan semanal</h2>
          <p className="text-sm text-muted-foreground">
            {plan
              ? `${plan.dias.map((d) => DIAS_LARGO[d - 1]).join(", ")}${diasFaltan !== null && diasFaltan > 0 ? ` · faltan ${diasFaltan} días para tu examen` : ""}`
              : "Elige tus días de estudio; cada uno es un simulacro de 30–40 minutos."}
          </p>
        </div>
        {plan && !blocked && (
          <Button type="button" variant="ghost" size="icon" onClick={() => setEditing(true)} aria-label="Editar plan">
            <Pencil />
          </Button>
        )}
      </div>

      {blocked ? (
        <Blocked kind={blocked} />
      ) : !plan ? (
        <Button type="button" size="sm" className="self-start" onClick={() => setEditing(true)}>
          Crear mi plan
        </Button>
      ) : (
        <>
          <ol className="grid grid-cols-7 gap-1.5" aria-label="Esta semana">
            {DIAS.map((d, i) => {
              const date = new Date(monday);
              date.setDate(monday.getDate() + i);
              const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
              const toca = plan.dias.includes(i + 1);
              const hecha = hechas.has(key);
              const esHoy = i + 1 === isoToday;
              return (
                <li
                  key={i}
                  className={cn(
                    "flex flex-col items-center gap-1 rounded-lg border py-1.5 text-xs",
                    !toca && "border-transparent text-muted-foreground/60",
                    esHoy && "border-primary",
                    hecha && "bg-secondary/15 text-secondary"
                  )}
                  aria-label={`${DIAS_LARGO[i]}${toca ? (hecha ? ": hecha" : ": sesión") : ": descanso"}`}
                >
                  <span className="font-semibold">{d}</span>
                  {hecha ? <CheckCircle2 className="size-3.5" /> : <span className={cn("size-1.5 rounded-full", toca ? "bg-foreground/40" : "bg-transparent")} />}
                </li>
              );
            })}
          </ol>
          {plan.hechaHoy ? (
            <p className="flex items-center gap-1.5 text-sm text-secondary">
              <CheckCircle2 className="size-4" /> Sesión de hoy completa.
            </p>
          ) : plan.tocaHoy ? (
            <Button asChild size="sm" className="self-start">
              <Link href={`${EXAM_PATH}?tipo=plan`}>Iniciar sesión de hoy</Link>
            </Button>
          ) : (
            <p className="text-sm text-muted-foreground">Hoy es día de descanso. Si quieres, haz una práctica libre.</p>
          )}
        </>
      )}

      <PlanDialog open={editing} plan={plan} onClose={() => setEditing(false)} onSaved={onChanged} />
    </section>
  );
}

function PlanDialog({ open, plan, onClose, onSaved }: { open: boolean; plan: ToeflPlan | null; onClose: () => void; onSaved: () => void }) {
  const [dias, setDias] = React.useState<number[]>(plan?.dias ?? [1, 3, 5]);
  const [fecha, setFecha] = React.useState(plan?.examDate ?? "");
  const [busy, setBusy] = React.useState<"save" | "delete" | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    setDias(plan?.dias ?? [1, 3, 5]);
    setFecha(plan?.examDate ?? "");
    setError(null);
  }, [open, plan]);

  async function run(kind: "save" | "delete") {
    setBusy(kind);
    setError(null);
    try {
      if (kind === "save") await guardarPlan(fecha || null, dias);
      else await cancelarPlan();
      onSaved();
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const minDate = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="gap-5 sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{plan ? "Editar plan TOEFL" : "Crear plan TOEFL"}</DialogTitle>
          <DialogDescription>Cada día elegido tendrás un simulacro de 30–40 minutos con tu nivel y el siguiente.</DialogDescription>
        </DialogHeader>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-medium">Días de estudio</legend>
          <div className="grid grid-cols-7 gap-1.5">
            {DIAS.map((d, i) => {
              const on = dias.includes(i + 1);
              return (
                <button
                  key={i}
                  type="button"
                  aria-pressed={on}
                  aria-label={DIAS_LARGO[i]}
                  onClick={() => setDias((prev) => (on ? prev.filter((x) => x !== i + 1) : [...prev, i + 1].sort()))}
                  className={cn(
                    "rounded-lg border py-2 text-sm font-semibold transition-colors hover:bg-accent",
                    on && "border-primary bg-primary/15 text-brand-light"
                  )}
                >
                  {d}
                </button>
              );
            })}
          </div>
        </fieldset>

        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Fecha de tu examen TOEFL (opcional)
          <input
            type="date"
            min={minDate}
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            className="h-10 rounded-md border bg-background px-3 text-sm font-normal"
          />
        </label>

        {error && (
          <p className="flex items-center gap-2 text-sm text-destructive" role="alert">
            <CircleAlert className="size-4 shrink-0" /> {error}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2">
          {plan && (
            <Button type="button" variant="ghost" className="text-destructive" onClick={() => run("delete")} disabled={busy !== null}>
              {busy === "delete" ? <Loader2 className="animate-spin" /> : <Trash2 />} Quitar plan
            </Button>
          )}
          <Button type="button" className="ml-auto" onClick={() => run("save")} disabled={busy !== null || dias.length === 0}>
            {busy === "save" && <Loader2 className="animate-spin" />} Guardar plan
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
