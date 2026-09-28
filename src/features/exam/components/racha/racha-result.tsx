"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, ClipboardList, Clock, Equal, Home, Lightbulb, Sparkles, Target, Timer, X, Zap } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Confetti } from "@/features/registro/components/confetti";
import { cn } from "@/lib/utils";

import { type ExamRecord, formatClock, type SnapshotQuestion } from "../../lib/libre";
import { cambioNivel, NIVEL_JUEGO, RACHA_APRUEBA, siguienteNivel } from "../../lib/racha";
import { RachaFacts } from "./racha-facts";
import { LevelLadder, PhoneFrame, StreakBadge } from "./racha-parts";

/**
 * Fin de partida: mismos datos que el reporte del Examen Libre (puntos, aciertos, tiempo, desglose por materia),
 * contados como marcador de juego. La guía de estudio son "Datos curiosos" en tarjetas deslizables.
 * El reporte formal sigue disponible en "Ver examen completo".
 */
export function RachaResult({ record, streak }: { record: ExamRecord; streak: { dias: number; jugoHoy: boolean } | null }) {
  const [facts, setFacts] = React.useState(false);
  const pct = record.maxScore > 0 ? Math.round((record.score / record.maxScore) * 100) : 0;
  const aprobo = record.maxScore > 0 && record.score / record.maxScore >= RACHA_APRUEBA;
  const aciertos = record.questions.filter((q) => q.ponderacion_obtenida >= 1).length;
  const fallas = record.questions.filter((q) => q.ponderacion_obtenida < 1);
  const next = siguienteNivel(record.level, record.score, record.maxScore);
  const dir = cambioNivel(record.level, next);
  const perfect = aciertos === record.totalQuestions;

  const title = record.timedOut ? "¡Se acabó el tiempo!" : perfect ? "¡Perfecta!" : aprobo ? "¡Racha superada!" : "¡Buen intento!";

  return (
    <PhoneFrame>
      {(dir === "sube" || perfect) && <Confetti />}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-96"
        style={{ background: `radial-gradient(60% 60% at 50% 0%, ${aprobo ? "rgb(18 194 169 / 0.3)" : "rgb(255 94 26 / 0.3)"}, transparent 70%)` }}
        aria-hidden
      />
      <main className="relative flex flex-col gap-5 px-5 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <header className="flex items-center justify-between gap-3">
          <Link href="/app/student" aria-label="Ir a mi home" className="grid size-10 place-items-center rounded-full bg-card/80 text-muted-foreground hover:text-foreground">
            <X className="size-5" />
          </Link>
          {record.folio && <span className="rounded-full bg-card/80 px-3 py-1.5 font-mono text-xs font-semibold">{record.folio}</span>}
        </header>

        {/* Marcador */}
        <section className="flex flex-col items-center gap-3 text-center">
          <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
            {record.universityKey} · {record.careerName}
          </p>
          <h1 className="font-display text-4xl font-black uppercase italic">{title}</h1>
          <ScoreRing value={pct} good={aprobo} />
          <p className="text-sm text-muted-foreground">
            <span className="font-bold text-foreground">
              {aciertos}/{record.totalQuestions}
            </span>{" "}
            aciertos
          </p>
          {streak && streak.dias > 0 && <StreakBadge days={streak.dias} className="text-base" />}
        </section>

        {/* Nivel */}
        <section className="rounded-3xl border bg-card/80 p-4">
          <div className="flex items-center gap-3">
            <span
              className={cn(
                "grid size-11 shrink-0 place-items-center rounded-2xl",
                dir === "sube" ? "bg-secondary/15 text-secondary" : dir === "baja" ? "bg-energy/15 text-energy" : "bg-gold/15 text-gold"
              )}
            >
              {dir === "sube" ? <ArrowUp className="size-6" /> : dir === "baja" ? <ArrowDown className="size-6" /> : <Equal className="size-6" />}
            </span>
            <div className="min-w-0">
              <p className="font-display text-lg font-bold">
                {dir === "sube" ? `¡Subes a ${NIVEL_JUEGO[next].nombre}!` : dir === "baja" ? `Bajas a ${NIVEL_JUEGO[next].nombre}` : `Sigues en ${NIVEL_JUEGO[next].nombre}`}
              </p>
              <p className="text-xs text-muted-foreground text-pretty">
                {dir === "igual" && next === "dificil"
                  ? "Estás en el nivel más alto. ¡Defiéndelo!"
                  : `Jugaste en ${NIVEL_JUEGO[record.level].nombre}. Con ${Math.round(RACHA_APRUEBA * 100)} % o más subes de nivel.`}
              </p>
            </div>
          </div>
          <LevelLadder nivel={next} className="mt-4" />
        </section>

        {/* Stats */}
        <dl className="grid grid-cols-2 gap-2">
          <Stat icon={Target} label="Puntos" value={`${pct} %`} />
          <Stat icon={Zap} label="Respondidas" value={`${record.answeredQuestions}/${record.totalQuestions}`} />
          <Stat icon={Timer} label="Tiempo" value={formatClock(record.timeSpentSeconds, true)} sub={`de ${formatClock(record.timeLimitSeconds, true)}`} />
          <Stat
            icon={Clock}
            label="Por pregunta"
            value={`${record.totalQuestions ? Math.round(record.timeSpentSeconds / record.totalQuestions) : 0} s`}
          />
        </dl>

        {/* Por materia */}
        <section className="flex flex-col gap-3 rounded-3xl border bg-card/80 p-4">
          <h2 className="font-display text-lg font-bold">Tu poder por materia</h2>
          <ul className="flex flex-col gap-2.5">
            {record.materias.map((m) => (
              <li key={m.materia_clave} className="flex items-center gap-3">
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{m.materia}</span>
                <Pips questions={record.questions.filter((q) => q.materia_clave === m.materia_clave)} />
                <span className="w-12 text-right font-mono text-xs text-muted-foreground tabular-nums">{Math.round(m.porcentaje_aciertos)} %</span>
              </li>
            ))}
          </ul>
          <p className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
            <Legend className="bg-secondary" label="Correcta" />
            <Legend className="bg-gold" label="Parcial" />
            <Legend className="bg-destructive" label="Fallada" />
            <Legend className="border border-dashed border-muted-foreground" label="Sin responder" />
          </p>
        </section>

        {/* Guía de estudio: datos curiosos */}
        {fallas.length > 0 ? (
          <button
            type="button"
            onClick={() => setFacts(true)}
            className="group flex items-center gap-4 rounded-3xl border-2 border-gold/50 bg-gold/10 p-4 text-left transition-colors hover:bg-gold/15 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-gold text-background">
              <Lightbulb className="size-7" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-display text-lg font-black">Datos curiosos · {fallas.length}</span>
              <span className="block text-sm text-muted-foreground text-pretty">Lo que se te escapó, en tarjetas rápidas. Desliza y aprende.</span>
            </span>
          </button>
        ) : (
          <p className="flex items-center justify-center gap-2 rounded-3xl border border-secondary/40 bg-secondary/10 p-4 text-sm font-semibold text-secondary">
            <Sparkles className="size-4" /> Sin fallas: nada que repasar hoy.
          </p>
        )}

        <div className="flex flex-col gap-2">
          <Button asChild variant="outline" className="h-12 rounded-2xl">
            <Link href={`/app/student/exam/resultado?id=${record.id}`}>
              <ClipboardList /> Ver examen completo
            </Link>
          </Button>
          <Button asChild variant="ghost" className="h-12 rounded-2xl">
            <Link href="/app/student">
              <Home /> Ir a mi home
            </Link>
          </Button>
        </div>
      </main>

      {facts && <RachaFacts questions={fallas} onClose={() => setFacts(false)} />}
    </PhoneFrame>
  );
}

function ScoreRing({ value, good }: { value: number; good: boolean }) {
  const r = 54;
  const c = 2 * Math.PI * r;
  const [shown, setShown] = React.useState(0);
  React.useEffect(() => {
    const t = setTimeout(() => setShown(value), 150);
    return () => clearTimeout(t);
  }, [value]);

  return (
    <div className="relative grid size-40 place-items-center">
      <svg viewBox="0 0 128 128" className="absolute inset-0 -rotate-90" aria-hidden>
        <circle cx="64" cy="64" r={r} fill="none" strokeWidth="12" className="stroke-muted" />
        <circle
          cx="64"
          cy="64"
          r={r}
          fill="none"
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - shown / 100)}
          className={cn("transition-[stroke-dashoffset] duration-1000 ease-out motion-reduce:transition-none", good ? "stroke-secondary" : "stroke-energy")}
        />
      </svg>
      <p className="flex flex-col items-center">
        <span className="font-display text-5xl font-black tabular-nums">{value}</span>
        <span className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">% puntos</span>
      </p>
    </div>
  );
}

/** Una pastilla por pregunta de la materia, del color de su resultado. */
function Pips({ questions }: { questions: SnapshotQuestion[] }) {
  return (
    <span className="flex shrink-0 gap-1">
      {questions.map((q) => (
        <span
          key={q.id_original}
          className={cn(
            "h-3 w-5 rounded-full",
            q.respuesta_seleccionada_id === null
              ? "border border-dashed border-muted-foreground"
              : q.ponderacion_obtenida >= 1
                ? "bg-secondary"
                : q.ponderacion_obtenida > 0
                  ? "bg-gold"
                  : "bg-destructive"
          )}
        />
      ))}
    </span>
  );
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={cn("h-2 w-3.5 rounded-full", className)} /> {label}
    </span>
  );
}

function Stat({ icon: Icon, label, value, sub }: { icon: typeof Timer; label: string; value: string; sub?: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-2xl border bg-card/60 p-3">
      <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="size-3.5 text-energy" /> {label}
      </dt>
      <dd className="font-mono text-lg font-bold tabular-nums">
        {value}
        {sub && <span className="ml-1.5 text-xs font-medium text-muted-foreground">{sub}</span>}
      </dd>
    </div>
  );
}
