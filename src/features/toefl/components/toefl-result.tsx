"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowUpRight, CircleAlert, Clock, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ModeGuard } from "@/features/modes/components/mode-guard";
import { PanelShell } from "@/features/modes/components/panel-shell";
import { cn } from "@/lib/utils";

import { MCER_INFO } from "../lib/mcer";
import { formatClock } from "../lib/player";
import { getIntento, type ToeflRecord } from "../services/toefl-service";
import { MCER_LEVELS, SECTION_LABEL } from "../types";
import { TOEFL_PATH } from "./toefl-home";

/** /app/student/toefl/resultado?id=: nivel asignado y desglose por sección y nivel MCER. */
export function ToeflResultPage() {
  return (
    <ModeGuard mode="student">
      <PanelShell>
        <React.Suspense fallback={<Loading />}>
          <ResultLoader />
        </React.Suspense>
      </PanelShell>
    </ModeGuard>
  );
}

function ResultLoader() {
  const id = Number(useSearchParams().get("id"));
  const [record, setRecord] = React.useState<ToeflRecord | null | undefined>(undefined);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!Number.isInteger(id) || id <= 0) return setRecord(null);
    let active = true;
    getIntento(id)
      .then((r) => active && setRecord(r))
      .catch((e: Error) => active && setError(e.message));
    return () => {
      active = false;
    };
  }, [id]);

  if (error || record === null) {
    return (
      <div className="flex flex-col items-start gap-4 rounded-2xl border bg-card p-6">
        <p role="alert" className="flex items-center gap-2 text-sm text-muted-foreground">
          <CircleAlert className="size-4 shrink-0" /> {error ?? "No encontramos este intento."}
        </p>
        <Button asChild variant="outline">
          <Link href={TOEFL_PATH}>Ir a TOEFL</Link>
        </Button>
      </div>
    );
  }
  if (record === undefined) return <Loading />;
  return <ToeflResult record={record} />;
}

function ToeflResult({ record }: { record: ToeflRecord }) {
  const pct = record.maximo > 0 ? Math.round((100 * record.puntos) / record.maximo) : 0;
  const info = MCER_INFO[record.nivel];
  const subio = record.nivelAnterior && MCER_LEVELS.indexOf(record.nivel) > MCER_LEVELS.indexOf(record.nivelAnterior);
  const porNivel = new Map(record.porNivel.map((n) => [n.nivel, n]));

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <Link href={TOEFL_PATH} className="mb-2 inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> TOEFL ITP
        </Link>
        <p className="font-mono text-xs text-muted-foreground">{record.folio}</p>
        <h1 className="text-2xl font-bold sm:text-3xl">{record.tipo === "toefl_diagnostico" ? "Resultado del diagnóstico" : "Resultado"}</h1>
        <p className="text-sm text-muted-foreground">
          {new Date(record.fecha).toLocaleString("es-MX", { dateStyle: "long", timeStyle: "short" })}
        </p>
      </header>

      <section className="flex flex-col items-center gap-3 rounded-2xl border bg-card p-6 text-center" aria-label="Nivel asignado">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Tu nivel inicial</p>
        <span className="grid size-24 place-items-center rounded-3xl bg-primary/15 text-4xl font-bold text-brand-light">{record.nivel}</span>
        <div>
          <p className="text-lg font-bold">{info.nombre}</p>
          <p className="text-sm text-muted-foreground">{info.descripcion}</p>
        </div>
        {record.nivelAnterior && record.nivelAnterior !== record.nivel && (
          <p className={cn("flex items-center gap-1 text-sm font-medium", subio ? "text-secondary" : "text-muted-foreground")}>
            {subio && <ArrowUpRight className="size-4" />}Antes: {record.nivelAnterior}
          </p>
        )}
      </section>

      <div className="grid grid-cols-3 gap-2">
        <Stat label="Aciertos" value={`${pct}%`} />
        <Stat label="Respondidas" value={`${record.respondidas}/${record.total}`} />
        <Stat label={record.agotado ? "Tiempo agotado" : "Tiempo"} value={formatClock(record.tiempoUsado)} icon />
      </div>

      <section className="flex flex-col gap-3 rounded-2xl border bg-card p-4 sm:p-5" aria-labelledby="toefl-secciones">
        <h2 id="toefl-secciones" className="font-semibold">
          Por sección
        </h2>
        <ul className="flex flex-col gap-3">
          {record.porSeccion.map((s) => (
            <li key={s.materia_clave} className="flex flex-col gap-1.5">
              <div className="flex items-baseline justify-between gap-2 text-sm">
                <span className="font-medium">{SECTION_LABEL[s.materia_clave]}</span>
                <span className="tabular-nums text-muted-foreground">
                  {s.correctas}/{s.total} · {Math.round(s.porcentaje_aciertos)}%
                </span>
              </div>
              <Bar value={s.porcentaje_aciertos} />
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-3 rounded-2xl border bg-card p-4 sm:p-5" aria-labelledby="toefl-niveles">
        <div>
          <h2 id="toefl-niveles" className="font-semibold">
            Por nivel MCER
          </h2>
          <p className="text-sm text-muted-foreground">Tu nivel es el más alto que aprobaste (50 % o más) sin saltarte niveles.</p>
        </div>
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {MCER_LEVELS.map((l) => {
            const n = porNivel.get(l);
            const ok = n && n.porcentaje_aciertos >= 50;
            return (
              <li
                key={l}
                className={cn(
                  "flex flex-col items-center rounded-xl border p-2 text-center",
                  !n && "border-dashed text-muted-foreground",
                  l === record.nivel && "border-primary bg-primary/10"
                )}
              >
                <span className="font-bold">{l}</span>
                <span className={cn("text-xs tabular-nums", n && (ok ? "text-secondary" : "text-destructive"))}>
                  {n ? `${n.correctas}/${n.total}` : "—"}
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      <Button asChild className="self-start">
        <Link href={TOEFL_PATH}>Ir a TOEFL ITP</Link>
      </Button>
    </div>
  );
}

function Bar({ value }: { value: number }) {
  return (
    <div className="h-2 overflow-hidden rounded-full bg-muted">
      <div
        className={cn("h-full rounded-full", value >= 80 ? "bg-secondary" : value >= 50 ? "bg-gold" : "bg-destructive")}
        style={{ width: `${Math.max(2, value)}%` }}
      />
    </div>
  );
}

function Stat({ label, value, icon }: { label: string; value: string; icon?: boolean }) {
  return (
    <div className="rounded-xl border bg-card px-2 py-3 text-center">
      <p className="flex items-center justify-center gap-1 text-xl font-bold tabular-nums">
        {icon && <Clock className="size-4 text-muted-foreground" />}
        {value}
      </p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function Loading() {
  return (
    <div className="grid place-items-center py-16" role="status" aria-label="Cargando resultado">
      <Loader2 className="size-6 animate-spin text-brand-light" />
    </div>
  );
}
