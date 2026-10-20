"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ChevronRight, CircleAlert, Clock, Gauge, Languages, Loader2, Lock } from "lucide-react";

import { Button } from "@/components/ui/button";
import { MenuItem } from "@/features/modes/components/account-menu";
import { ModeGuard, useMode } from "@/features/modes/components/mode-guard";
import { PanelShell } from "@/features/modes/components/panel-shell";
import { AddSchoolMenuItem } from "@/features/student/components/add-school-menu-item";
import { cn } from "@/lib/utils";

import { MCER_INFO } from "../lib/mcer";
import { getEstado, setAgeRange, type ToeflEstado } from "../services/toefl-service";
import { AGE_RANGE_LABEL, AGE_RANGES, type AgeRange } from "../types";

export const TOEFL_PATH = "/app/student/toefl";

/** «TOEFL ITP» del menú de cuenta del alumno. */
export function ToeflMenuItem() {
  const router = useRouter();
  return <MenuItem icon={Languages} label="TOEFL ITP" onClick={() => router.push(TOEFL_PATH)} />;
}

/** /app/student/toefl: nivel MCER actual, rango de edad, diagnóstico e historial. */
export function ToeflHomePage() {
  return (
    <ModeGuard mode="student">
      <PanelShell accountExtra={<AddSchoolMenuItem />}>
        <ToeflHome />
      </PanelShell>
    </ModeGuard>
  );
}

function ToeflHome() {
  const { viewer } = useMode();
  const [estado, setEstado] = React.useState<ToeflEstado | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState<AgeRange | null>(null);

  const load = React.useCallback(() => {
    getEstado()
      .then(setEstado)
      .catch((e: Error) => setError(e.message));
  }, []);
  React.useEffect(load, [load]);

  async function pickAge(age: AgeRange) {
    if (!estado || age === estado.ageRange) return;
    setSaving(age);
    setError(null);
    try {
      await setAgeRange(viewer.id, age);
      load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <Link href="/app/student" className="mb-2 inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> Mi home
        </Link>
        <h1 className="text-2xl font-bold sm:text-3xl">TOEFL ITP</h1>
        <p className="text-sm text-muted-foreground">Exámenes en inglés, como el real, adaptados a tu edad y a tu nivel.</p>
      </header>

      {error && (
        <p className="flex items-center gap-2 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm" role="alert">
          <CircleAlert className="size-4 shrink-0 text-destructive" /> {error}
        </p>
      )}

      {!estado && !error && (
        <div className="grid place-items-center py-16" role="status" aria-label="Cargando">
          <Loader2 className="size-6 animate-spin text-brand-light" />
        </div>
      )}

      {estado && (
        <>
          <LevelCard estado={estado} />

          <section className="flex flex-col gap-3 rounded-2xl border bg-card p-4 sm:p-5" aria-labelledby="toefl-edad">
            <div>
              <h2 id="toefl-edad" className="font-semibold">
                Versión del examen
              </h2>
              <p className="text-sm text-muted-foreground">Las preguntas se adaptan a tu edad.</p>
            </div>
            <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-labelledby="toefl-edad">
              {AGE_RANGES.map((a) => (
                <button
                  key={a}
                  type="button"
                  role="radio"
                  aria-checked={estado.ageRange === a}
                  onClick={() => pickAge(a)}
                  disabled={saving !== null}
                  className={cn(
                    "flex items-center justify-center gap-1.5 rounded-xl border px-2 py-2.5 text-sm font-medium transition-colors hover:bg-accent",
                    estado.ageRange === a && "border-primary bg-primary/10 text-brand-light"
                  )}
                >
                  {saving === a && <Loader2 className="size-3.5 animate-spin" />}
                  {AGE_RANGE_LABEL[a]}
                </button>
              ))}
            </div>
          </section>

          <DiagnosticoCard estado={estado} />

          {estado.historial.length > 0 && (
            <section className="flex flex-col gap-3" aria-labelledby="toefl-historial">
              <h2 id="toefl-historial" className="font-semibold">
                Tus intentos
              </h2>
              <ul className="divide-y rounded-2xl border bg-card">
                {estado.historial.map((h) => (
                  <li key={h.id}>
                    <Link href={`${TOEFL_PATH}/resultado?id=${h.id}`} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-accent">
                      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/15 font-bold text-brand-light">{h.nivel}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium">{h.tipo === "toefl_diagnostico" ? "Diagnóstico" : "Práctica"}</span>
                        <span className="block text-xs text-muted-foreground">
                          {new Date(h.fecha).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" })} · {h.folio}
                        </span>
                      </span>
                      <span className="font-semibold tabular-nums">{h.aciertos}%</span>
                      <ChevronRight className="size-4 text-muted-foreground" />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function LevelCard({ estado }: { estado: ToeflEstado }) {
  const info = estado.nivel ? MCER_INFO[estado.nivel] : null;
  return (
    <section className="flex items-center gap-4 rounded-2xl border bg-card p-4 sm:p-5" aria-label="Tu nivel">
      <span className="grid size-16 shrink-0 place-items-center rounded-2xl bg-primary/15 text-2xl font-bold text-brand-light">
        {estado.nivel ?? <Gauge className="size-7" />}
      </span>
      <div className="min-w-0">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Tu nivel MCER</p>
        <p className="text-lg font-bold">{info ? info.nombre : "Aún sin nivel"}</p>
        <p className="text-sm text-muted-foreground">{info ? info.descripcion : "Presenta el diagnóstico para conocer tu punto de partida."}</p>
      </div>
    </section>
  );
}

function DiagnosticoCard({ estado }: { estado: ToeflEstado }) {
  const sinPreguntas = estado.preguntasDisponibles < 6;
  const repetir = estado.diagnosticos > 0;
  return (
    <section className="flex flex-col gap-4 rounded-2xl border bg-card p-4 sm:p-5" aria-labelledby="toefl-diagnostico">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-secondary/15 text-secondary">
          <Clock className="size-5" />
        </span>
        <div>
          <h2 id="toefl-diagnostico" className="font-semibold">
            Diagnóstico express
          </h2>
          <p className="text-sm text-muted-foreground">15 minutos · 10–12 preguntas de Listening, Structure y Reading. Define tu nivel inicial.</p>
        </div>
      </div>
      {sinPreguntas ? (
        <p className="text-sm text-muted-foreground">Estamos cargando las preguntas de esta versión. Vuelve pronto.</p>
      ) : estado.puedeDiagnostico ? (
        <Button asChild className="self-start">
          <Link href={`${TOEFL_PATH}/diagnostico`}>{repetir ? "Repetir diagnóstico" : "Presentar diagnóstico"}</Link>
        </Button>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Lock className="size-4" /> Repetir el diagnóstico es parte del acceso ilimitado.
          </p>
          <Button asChild variant="outline" size="sm">
            <Link href="/pricing">Ver planes</Link>
          </Button>
        </div>
      )}
    </section>
  );
}
