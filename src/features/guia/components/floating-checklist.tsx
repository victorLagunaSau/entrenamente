"use client";

import * as React from "react";
import Link from "next/link";
import { Check, ChevronDown, ChevronUp, Rocket, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import type { GuiaAccion, GuiaPaso, GuiaTone } from "../types";

const ICON_TONE: Record<GuiaTone, string> = {
  brand: "bg-primary/15 text-brand-light",
  secondary: "bg-secondary/15 text-secondary",
  energy: "bg-energy/15 text-energy",
};

/**
 * Guía de inicio como notificación flotante (abajo a la derecha, sobre el menú inferior en celular; ahí más baja
 * y compacta para no tapar la pantalla, y siempre bajo el header y sus notificaciones): avance
 * "n/total" con barra y los pasos en acordeón, con el siguiente pendiente abierto. Se minimiza a una pastilla y
 * `onDismiss` la cierra. `abrir` cambia → se vuelve a desplegar (p. ej. al pedirla desde el menú).
 */
export function FloatingChecklist({
  title,
  pasos,
  sugerido,
  onDismiss,
  abrir = 0,
}: {
  title: string;
  pasos: GuiaPaso[];
  sugerido?: string;
  onDismiss: () => void;
  abrir?: number;
}) {
  const hechos = pasos.filter((p) => p.hecho).length;
  const siguiente = pasos.find((p) => !p.hecho)?.id ?? null;
  const [minimizada, setMinimizada] = React.useState(false);
  const [abierto, setAbierto] = React.useState<string | null>(siguiente);
  const pct = Math.round((hechos / pasos.length) * 100);

  React.useEffect(() => {
    if (abrir > 0) setMinimizada(false);
  }, [abrir]);
  React.useEffect(() => setAbierto(siguiente), [siguiente]);

  const progreso = (
    <span className="tabular-nums">
      {hechos}/{pasos.length}
    </span>
  );

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-40 flex justify-end px-4 lg:bottom-6 lg:px-6">
      {minimizada ? (
        <button
          type="button"
          onClick={() => setMinimizada(false)}
          className="pointer-events-auto flex items-center gap-2 rounded-full border border-brand-light/40 bg-card px-4 py-2.5 text-sm font-semibold shadow-2xl shadow-glow-secondary transition-transform hover:-translate-y-0.5 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:zoom-in-95"
          aria-label={`Abrir guía de inicio, ${hechos} de ${pasos.length} pasos`}
        >
          <span className="grid size-6 place-items-center rounded-full bg-brand-gradient text-white">
            <Rocket className="size-3.5" aria-hidden />
          </span>
          Guía de inicio · {progreso}
          <ChevronUp className="size-4 text-muted-foreground" aria-hidden />
        </button>
      ) : (
        <section
          id="guia-inicio"
          role="dialog"
          aria-modal="false"
          aria-labelledby="guia-inicio-title"
          className="pointer-events-auto flex max-h-[min(26rem,calc(100dvh-14rem))] w-full lg:max-h-[min(34rem,calc(100dvh-10rem))] max-w-sm flex-col overflow-hidden rounded-2xl border border-brand-light/40 bg-card shadow-2xl shadow-glow-secondary motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-6"
        >
          <header className="flex flex-col gap-2.5 bg-primary/10 p-3 sm:gap-3 sm:p-4 sm:pb-3">
            <div className="flex items-start gap-3">
              <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-brand-gradient text-white sm:size-9">
                <Rocket className="size-4" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold tracking-wide text-brand-light uppercase">Guía de inicio · {progreso}</p>
                <h2 id="guia-inicio-title" className="text-sm leading-snug font-bold text-balance sm:text-base">
                  {title}
                </h2>
              </div>
              <div className="-mt-1 -mr-1 flex shrink-0">
                <Button variant="ghost" size="icon" className="size-8" onClick={() => setMinimizada(true)} aria-label="Minimizar guía">
                  <ChevronDown className="size-4" />
                </Button>
                <Button variant="ghost" size="icon" className="size-8" onClick={onDismiss} aria-label="Cerrar guía">
                  <X className="size-4" />
                </Button>
              </div>
            </div>
            <div
              className="h-1.5 overflow-hidden rounded-full bg-muted"
              role="progressbar"
              aria-label="Avance de la guía"
              aria-valuemin={0}
              aria-valuemax={pasos.length}
              aria-valuenow={hechos}
            >
              <div className="h-full rounded-full bg-brand-gradient transition-[width] duration-500" style={{ width: `${pct}%` }} />
            </div>
          </header>

          <ol className="flex flex-col gap-1 overflow-y-auto p-2">
            {pasos.map((paso, n) => (
              <PasoFila
                key={paso.id}
                paso={paso}
                n={n + 1}
                abierto={abierto === paso.id}
                actual={paso.id === siguiente}
                sugerido={paso.id === sugerido}
                onToggle={() => setAbierto((a) => (a === paso.id ? null : paso.id))}
              />
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}

function PasoFila({
  paso,
  n,
  abierto,
  actual,
  sugerido,
  onToggle,
}: {
  paso: GuiaPaso;
  n: number;
  abierto: boolean;
  actual: boolean;
  sugerido: boolean;
  onToggle: () => void;
}) {
  const Icon = paso.icon;
  const hecho = !!paso.hecho;
  const bodyId = `guia-paso-${paso.id}`;
  return (
    <li className={cn("rounded-xl transition-colors", abierto && !hecho && "bg-primary/10")}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={abierto}
        aria-controls={bodyId}
        className="flex w-full items-center gap-3 rounded-xl p-2.5 text-left hover:bg-accent/60 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <span
          className={cn(
            "grid size-8 shrink-0 place-items-center rounded-lg",
            hecho ? "bg-secondary text-secondary-foreground" : ICON_TONE[paso.tone ?? "brand"],
            !hecho && paso.tone === "energy" && "motion-safe:animate-pulse"
          )}
        >
          {hecho ? <Check className="size-4" aria-hidden /> : <Icon className="size-4" aria-hidden />}
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
            Paso {n}
            {hecho ? (
              <span className="rounded-full bg-secondary/15 px-1.5 text-secondary normal-case">Listo</span>
            ) : (
              sugerido && <span className="rounded-full bg-energy/15 px-1.5 text-energy normal-case">Sugerido</span>
            )}
          </span>
          <span className={cn("text-sm font-semibold text-pretty", hecho && "text-muted-foreground line-through decoration-secondary/60")}>
            {paso.title}
          </span>
        </span>
        <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform", abierto && "rotate-180")} aria-hidden />
      </button>
      {abierto && (
        <div id={bodyId} className="flex flex-col gap-3 px-2.5 pb-3 pl-[3.25rem]">
          <p className="text-sm text-muted-foreground text-pretty">{hecho ? "¡Listo! Ya completaste este paso." : paso.body}</p>
          {paso.accion && !hecho && <AccionButton accion={paso.accion} variant={actual ? "brand" : "outline"} />}
        </div>
      )}
    </li>
  );
}

function AccionButton({ accion, variant }: { accion: GuiaAccion; variant: "brand" | "outline" }) {
  if (accion.href) {
    return (
      <Button asChild variant={variant} size="sm" className="h-9 w-full">
        <Link href={accion.href} onClick={accion.onClick}>
          {accion.label}
        </Link>
      </Button>
    );
  }
  return (
    <Button variant={variant} size="sm" className="h-9 w-full" onClick={accion.onClick}>
      {accion.label}
    </Button>
  );
}
