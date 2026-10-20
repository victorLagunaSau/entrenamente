"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, CircleAlert, Clock, Flame, Headphones, ListChecks, Loader2, RotateCcw, Send, TrendingUp } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useUniTheme } from "@/features/exam/lib/uni-theme";
import { ModeGuard } from "@/features/modes/components/mode-guard";

import type { PlayerItem, PlayerSheet } from "../lib/player";
import {
  DIAGNOSTICO_SEGUNDOS,
  type ExamTipo,
  generarDiagnostico,
  generarExamen,
  guardarDiagnostico,
  guardarExamen,
  ToeflError,
} from "../services/toefl-service";
import type { McerLevel } from "../types";
import { TOEFL_PATH } from "./toefl-home";
import { ToeflPlayer } from "./toefl-player";

type Prepared = { items: PlayerItem[]; limit: number; nivel?: McerLevel; nivelSuperior?: McerLevel | null };

type FlowConfig = {
  title: string;
  heading: string;
  subtitle: string;
  prepare: () => Promise<Prepared>;
  save: (sheet: PlayerSheet) => Promise<number>;
  notes: (p: Prepared | null) => { icon: typeof Clock; title: string; text: string }[];
};

const AUDIO_NOTE = {
  icon: Headphones,
  title: "Audio plays once",
  text: "You cannot pause, rewind or replay it. Use headphones and check your volume before you start.",
};
const REVIEW_NOTE = {
  icon: Send,
  title: "Review before submitting",
  text: "You can go back, change answers and mark questions for review until you submit.",
};
const minutes = (s: number) => `${Math.round(s / 60)} minutes`;

const DIAGNOSTICO: FlowConfig = {
  title: "TOEFL ITP · Diagnostic Test",
  heading: "Diagnostic Test",
  subtitle: "Express placement: we use it to set your starting CEFR level.",
  prepare: async () => ({ items: await generarDiagnostico(), limit: DIAGNOSTICO_SEGUNDOS }),
  save: guardarDiagnostico,
  notes: (p) => [
    { icon: Clock, title: "15 minutes", text: "The timer starts when you begin and the test is submitted automatically when time runs out." },
    {
      icon: ListChecks,
      title: p ? `${p.items.length} questions` : "10–12 questions",
      text: "Listening, Structure and Reading, from A1 to C2. Unanswered questions count as incorrect.",
    },
    AUDIO_NOTE,
    REVIEW_NOTE,
  ],
};

function examConfig(tipo: ExamTipo): FlowConfig {
  const prepare = async (): Promise<Prepared> => {
    const e = await generarExamen(tipo);
    return { items: e.items, limit: e.tiempoLimite, nivel: e.nivel, nivelSuperior: e.nivelSuperior };
  };
  const save = (sheet: PlayerSheet) => guardarExamen(tipo, sheet);
  const levelNote = (p: Prepared | null) => ({
    icon: TrendingUp,
    title: p?.nivel ? (p.nivelSuperior ? `Level ${p.nivel} + ${p.nivelSuperior}` : `Level ${p.nivel}`) : "Your level + the next one",
    text: p?.nivelSuperior
      ? `60% of the questions are ${p.nivel} and 40% are ${p.nivelSuperior}.`
      : "60% of the questions are at your level and 40% at the next one.",
  });

  if (tipo === "toefl_racha") {
    return {
      title: "TOEFL ITP · Daily Streak",
      heading: "Daily Streak",
      subtitle: "5 quick questions to keep your streak alive.",
      prepare,
      save,
      notes: (p) => [
        { icon: Flame, title: "10 minutes · 5 questions", text: "One streak per day. The test is submitted automatically when time runs out." },
        levelNote(p),
        AUDIO_NOTE,
      ],
    };
  }

  const plan = tipo === "toefl_plan";
  return {
    title: plan ? "TOEFL ITP · Study Plan Session" : "TOEFL ITP · Practice Test",
    heading: plan ? "Study Plan Session" : "Practice Test",
    subtitle: "Score 80% or more on the next-level questions in two tests in a row to move up a level.",
    prepare,
    save,
    notes: (p) => [
      {
        icon: Clock,
        title: p ? `${minutes(p.limit)} · ${p.items.length} questions` : "30–40 minutes",
        text: "The timer starts when you begin and the test is submitted automatically when time runs out.",
      },
      levelNote(p),
      AUDIO_NOTE,
      REVIEW_NOTE,
    ],
  };
}

const TIPOS: Record<string, ExamTipo> = { practica: "toefl_practica", plan: "toefl_plan", racha: "toefl_racha" };

/** /app/student/toefl/diagnostico */
export function ToeflDiagnosticoPage() {
  return (
    <ModeGuard mode="student">
      <ExamFlow config={DIAGNOSTICO} />
    </ModeGuard>
  );
}

/** /app/student/toefl/examen?tipo=practica|plan|racha */
export function ToeflExamPage() {
  return (
    <ModeGuard mode="student">
      <React.Suspense fallback={null}>
        <ExamByType />
      </React.Suspense>
    </ModeGuard>
  );
}

function ExamByType() {
  const tipo = TIPOS[useSearchParams().get("tipo") ?? ""] ?? "toefl_practica";
  const config = React.useMemo(() => examConfig(tipo), [tipo]);
  return <ExamFlow key={tipo} config={config} />;
}

/** Indicaciones (en inglés, mientras se arma el examen) → <ToeflPlayer/> → resultado (otra ruta). */
function ExamFlow({ config }: { config: FlowConfig }) {
  useUniTheme("toefl");
  const router = useRouter();
  const [prepared, setPrepared] = React.useState<Prepared | null>(null);
  const [error, setError] = React.useState<ToeflError | null>(null);
  const [attempt, setAttempt] = React.useState(0);
  const [started, setStarted] = React.useState(false);

  React.useEffect(() => {
    let active = true;
    setError(null);
    config
      .prepare()
      .then((r) => active && setPrepared(r))
      .catch((e: unknown) => active && setError(e instanceof ToeflError ? e : new ToeflError("We could not prepare your test.")));
    return () => {
      active = false;
    };
  }, [config, attempt]);

  const onSubmit = React.useCallback(
    async (sheet: PlayerSheet) => {
      const id = await config.save(sheet);
      router.replace(`${TOEFL_PATH}/resultado?id=${id}`);
    },
    [config, router]
  );

  if (started && prepared) {
    return <ToeflPlayer title={config.title} items={prepared.items} limitSeconds={prepared.limit} onSubmit={onSubmit} />;
  }

  return (
    <div className="min-h-dvh bg-background" lang="en">
      <div className="mx-auto flex max-w-xl flex-col gap-5 px-4 py-8">
        <Link href={TOEFL_PATH} className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> Back
        </Link>
        <header className="flex flex-col gap-1">
          <p className="text-xs font-semibold tracking-widest text-[var(--uni-accent,var(--primary))] uppercase">TOEFL ITP</p>
          <h1 className="text-2xl font-bold">{config.heading}</h1>
          <p className="text-sm text-muted-foreground">{config.subtitle}</p>
        </header>

        <ul className="flex flex-col gap-3 rounded-2xl border bg-card p-5 text-sm">
          {config.notes(prepared).map((n) => (
            <li key={n.title} className="flex gap-3">
              <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-muted text-[var(--uni-accent,var(--primary))]">
                <n.icon className="size-4" />
              </span>
              <div>
                <p className="font-semibold">{n.title}</p>
                <p className="text-muted-foreground">{n.text}</p>
              </div>
            </li>
          ))}
        </ul>

        {error ? (
          <div className="flex flex-col gap-3 rounded-2xl border border-destructive/40 bg-destructive/5 p-4" role="alert">
            <p className="flex items-start gap-2 text-sm" lang="es">
              <CircleAlert className="mt-0.5 size-4 shrink-0 text-destructive" /> {error.message}
            </p>
            <div className="flex flex-wrap gap-2">
              {error.locked ? (
                <Button asChild>
                  <Link href="/pricing">Ver planes</Link>
                </Button>
              ) : (
                <Button type="button" variant="outline" onClick={() => setAttempt((a) => a + 1)}>
                  <RotateCcw /> Try again
                </Button>
              )}
            </div>
          </div>
        ) : (
          <Button type="button" size="lg" className="self-center" onClick={() => setStarted(true)} disabled={!prepared}>
            {!prepared && <Loader2 className="animate-spin" />}
            {prepared ? "I understand — Start test" : "Preparing your test…"}
          </Button>
        )}
      </div>
    </div>
  );
}
