"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, CircleAlert, Clock, Headphones, ListChecks, Loader2, RotateCcw, Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useUniTheme } from "@/features/exam/lib/uni-theme";
import { ModeGuard } from "@/features/modes/components/mode-guard";

import type { PlayerItem, PlayerSheet } from "../lib/player";
import { DIAGNOSTICO_SEGUNDOS, generarDiagnostico, guardarDiagnostico, ToeflError } from "../services/toefl-service";
import { ToeflPlayer } from "./toefl-player";

/** /app/student/toefl/diagnostico: indicaciones (mientras se arma) → examen → resultado (otra ruta). */
export function ToeflDiagnosticoPage() {
  return (
    <ModeGuard mode="student">
      <DiagnosticoFlow />
    </ModeGuard>
  );
}

function DiagnosticoFlow() {
  useUniTheme("toefl");
  const router = useRouter();
  const [items, setItems] = React.useState<PlayerItem[] | null>(null);
  const [error, setError] = React.useState<ToeflError | null>(null);
  const [attempt, setAttempt] = React.useState(0);
  const [started, setStarted] = React.useState(false);

  React.useEffect(() => {
    let active = true;
    setError(null);
    generarDiagnostico()
      .then((r) => active && setItems(r))
      .catch((e: unknown) => active && setError(e instanceof ToeflError ? e : new ToeflError("We could not prepare your test.")));
    return () => {
      active = false;
    };
  }, [attempt]);

  const onSubmit = React.useCallback(
    async (sheet: PlayerSheet) => {
      const id = await guardarDiagnostico(sheet);
      router.replace(`/app/student/toefl/resultado?id=${id}`);
    },
    [router]
  );

  if (started && items) {
    return <ToeflPlayer title="TOEFL ITP · Diagnostic Test" items={items} limitSeconds={DIAGNOSTICO_SEGUNDOS} onSubmit={onSubmit} />;
  }

  return (
    <div className="min-h-dvh bg-background" lang="en">
      <div className="mx-auto flex max-w-xl flex-col gap-5 px-4 py-8">
        <Link href="/app/student/toefl" className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> Back
        </Link>
        <header className="flex flex-col gap-1">
          <p className="text-xs font-semibold tracking-widest text-[var(--uni-accent,var(--primary))] uppercase">TOEFL ITP</p>
          <h1 className="text-2xl font-bold">Diagnostic Test</h1>
          <p className="text-sm text-muted-foreground">Express placement: we use it to set your starting CEFR level.</p>
        </header>

        <ul className="flex flex-col gap-3 rounded-2xl border bg-card p-5 text-sm">
          <Note icon={Clock} title="15 minutes">
            The timer starts when you begin and the test is submitted automatically when time runs out.
          </Note>
          <Note icon={ListChecks} title={items ? `${items.length} questions` : "10–12 questions"}>
            Listening, Structure and Reading, from A1 to C2. Unanswered questions count as incorrect.
          </Note>
          <Note icon={Headphones} title="Audio plays once">
            You cannot pause, rewind or replay it. Use headphones and check your volume before you start.
          </Note>
          <Note icon={Send} title="Review before submitting">
            You can go back, change answers and mark questions for review until you submit.
          </Note>
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
          <Button type="button" size="lg" className="self-center" onClick={() => setStarted(true)} disabled={!items}>
            {!items && <Loader2 className="animate-spin" />}
            {items ? "I understand — Start test" : "Preparing your test…"}
          </Button>
        )}
      </div>
    </div>
  );
}

function Note({ icon: Icon, title, children }: { icon: typeof Clock; title: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-muted text-[var(--uni-accent,var(--primary))]">
        <Icon className="size-4" />
      </span>
      <div>
        <p className="font-semibold">{title}</p>
        <p className="text-muted-foreground">{children}</p>
      </div>
    </li>
  );
}
