"use client";

import { ArrowLeft, CircleAlert, Loader2, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { BRAND } from "@/lib/brand";

import { type ExamConfig, formatClock, NIVELES } from "../../lib/libre";
import { UniBar } from "./uni-bar";

/**
 * Indicaciones previas + aviso legal mientras se arma el examen. El cronómetro no arranca
 * hasta "Entiendo, estoy listo para iniciar". `summary` null = el examen se sigue armando.
 */
export function ExamDisclaimer({
  config,
  summary,
  error,
  onAccept,
  onBack,
  onRetry,
}: {
  config: ExamConfig;
  summary: { preguntas: number; segundos: number } | null;
  error: string | null;
  onAccept: () => void;
  onBack: () => void;
  onRetry: () => void;
}) {
  const empty = summary?.preguntas === 0;
  const nivel = NIVELES.find((n) => n.value === config.nivel)?.nombre;
  const tiempo = summary ? formatClock(summary.segundos) : null;

  return (
    <div className="flex min-h-dvh flex-col">
      <UniBar target={config} />
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-4 p-4 md:p-8">
        <div className="flex flex-col items-center gap-1 text-center">
          <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">Examen libre · {nivel}</p>
          <h1 className="text-2xl font-bold">Antes de comenzar</h1>
          <p className="flex min-h-5 items-center gap-2 text-sm text-muted-foreground" role="status" aria-live="polite">
            {error ? (
              <span className="flex items-center gap-2 text-destructive">
                <CircleAlert className="size-4 shrink-0" /> {error}
              </span>
            ) : !summary ? (
              <>
                <Loader2 className="size-4 animate-spin motion-reduce:animate-none" /> Preparando tu examen…
              </>
            ) : empty ? (
              <span className="text-destructive">No encontramos preguntas para esta combinación.</span>
            ) : (
              <>
                {summary.preguntas} preguntas · tiempo total <span className="font-mono text-foreground">{tiempo}</span>
              </>
            )}
          </p>
        </div>

        <section aria-label="Indicaciones" className="max-h-[55dvh] overflow-y-auto rounded-2xl border bg-card p-5 shadow-sm sm:p-6">
          <ol className="flex flex-col gap-5 text-sm leading-relaxed">
            <Point n={1} title="Prepárate para presentar el examen">
              Despeja tu espacio y tu tiempo como si fuera el día del examen real. Busca un lugar tranquilo, bien iluminado y sin
              distracciones; avisa a quienes te rodean que no te interrumpan, silencia las notificaciones del celular y ten agua a la mano.
              Revisa que tu conexión sea estable y tu equipo tenga batería suficiente. Asegúrate de contar con el tiempo completo
              {tiempo ? <> (<span className="font-mono">{tiempo}</span>)</> : null} antes de comenzar: el reloj corre sin pausas.
            </Point>
            <Point n={2} title="Ten hojas de papel a la mano">
              Te recomendamos usar algunas hojas de papel y un lápiz para desarrollar los ejercicios matemáticos, hacer diagramas o
              tomar notas mientras resuelves.
            </Point>
            <Point n={3} title="El examen no se interrumpe">
              Si sales o no lo terminas, el examen se elimina y tendrás que hacerlo desde cero nuevamente. Lo que entrenamos es presentar
              y terminar exámenes completos: no guardamos exámenes para contestarlos por partes.
            </Point>
            <Point n={4} title="Aviso importante">
              {BRAND.name} es una herramienta independiente de entrenamiento psicométrico y simulación académica. Hacer estas pruebas{" "}
              <strong>no garantiza</strong> la admisión o ingreso a ninguna universidad, institución o carrera. Los resultados son
              diagnósticos de práctica: no representan una evaluación oficial ni guardan relación directa con los procesos de selección
              de las instituciones mencionadas.
            </Point>
          </ol>
        </section>

        <div className="flex flex-col items-center gap-2">
          {error ? (
            <Button size="lg" onClick={onRetry}>
              <RotateCcw /> Reintentar
            </Button>
          ) : (
            <Button size="lg" disabled={!summary || empty} onClick={onAccept} className="min-w-72">
              {!summary && <Loader2 className="animate-spin motion-reduce:animate-none" />}
              Entiendo, estoy listo para iniciar
            </Button>
          )}
          <Button variant="ghost" onClick={onBack}>
            <ArrowLeft /> Cambiar examen
          </Button>
        </div>
      </main>
    </div>
  );
}

function Point({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary font-mono text-xs font-bold text-primary-foreground">{n}</span>
      <div className="min-w-0">
        <p className="font-semibold text-primary">{title}</p>
        <p className="mt-1 text-muted-foreground text-pretty">{children}</p>
      </div>
    </li>
  );
}
