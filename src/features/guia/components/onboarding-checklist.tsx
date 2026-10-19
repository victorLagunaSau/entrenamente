"use client";

import * as React from "react";
import Link from "next/link";
import { Check, Rocket, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import type { GuiaAccion, GuiaPaso, GuiaTone } from "../types";

const ICON_TONE: Record<GuiaTone, string> = {
  brand: "bg-primary/15 text-brand-light",
  secondary: "bg-secondary/15 text-secondary",
  energy: "bg-energy/15 text-energy",
};

/**
 * Guía de inicio con avance real (tipo Stripe): título con "n/total" y barra, y un paso por fila (`list`) o por
 * columna (`grid`). El avance lo decide quien la usa (`hecho` en cada paso); el primer paso pendiente se
 * resalta como el siguiente. `onDismiss` agrega el botón para ocultarla.
 */
export function OnboardingChecklist({
  title,
  pasos,
  layout = "list",
  sugerido,
  onDismiss,
  className,
}: {
  title: string;
  pasos: GuiaPaso[];
  layout?: "list" | "grid";
  /** Paso recomendado (lleva la etiqueta "Sugerido" mientras esté pendiente). */
  sugerido?: string;
  onDismiss?: () => void;
  className?: string;
}) {
  const hechos = pasos.filter((p) => p.hecho).length;
  const siguiente = pasos.find((p) => !p.hecho)?.id;
  const pct = Math.round((hechos / pasos.length) * 100);

  return (
    <section id="guia-inicio" aria-labelledby="guia-inicio-title" className={cn("relative flex scroll-mt-20 flex-col gap-4 overflow-hidden rounded-2xl border border-brand-light/30 bg-card p-5 sm:p-6", className)}>
      <div aria-hidden className="pointer-events-none absolute -top-20 -left-20 size-56 rounded-full bg-brand-gradient opacity-10 blur-3xl" />
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <p className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-brand-light uppercase">
            <Rocket className="size-3.5" aria-hidden /> Guía de inicio · {hechos}/{pasos.length}
          </p>
          <h2 id="guia-inicio-title" className="text-lg font-bold text-balance">
            {title}
          </h2>
        </div>
        {onDismiss && (
          <Button variant="ghost" size="icon" className="-mt-2 -mr-2 shrink-0" onClick={onDismiss} aria-label="Ocultar guía de inicio">
            <X className="size-5" />
          </Button>
        )}
      </div>

      <div
        className="h-2 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-label="Avance de la guía"
        aria-valuemin={0}
        aria-valuemax={pasos.length}
        aria-valuenow={hechos}
      >
        <div className="h-full rounded-full bg-brand-gradient transition-[width] duration-500" style={{ width: `${pct}%` }} />
      </div>

      <ol className={cn("grid gap-3", layout === "grid" ? "md:grid-cols-3" : "grid-cols-1")}>
        {pasos.map((paso, n) => (
          <PasoItem key={paso.id} paso={paso} n={n + 1} actual={paso.id === siguiente} sugerido={paso.id === sugerido} layout={layout} />
        ))}
      </ol>
    </section>
  );
}

function PasoItem({ paso, n, actual, sugerido, layout }: { paso: GuiaPaso; n: number; actual: boolean; sugerido: boolean; layout: "list" | "grid" }) {
  const Icon = paso.icon;
  const hecho = !!paso.hecho;
  return (
    <li
      className={cn(
        "flex gap-3 rounded-xl border p-4 transition-colors",
        layout === "grid" ? "flex-col" : "flex-col sm:flex-row sm:items-center",
        hecho ? "border-secondary/30 bg-secondary/5" : actual ? "border-brand-light/50 bg-primary/10 shadow-glow-secondary" : "bg-background/40"
      )}
    >
      <div className={cn("flex min-w-0 flex-1 gap-3", layout === "grid" && "flex-col")}>
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "grid size-10 shrink-0 place-items-center rounded-lg",
              hecho ? "bg-secondary text-secondary-foreground" : ICON_TONE[paso.tone ?? "brand"],
              !hecho && paso.tone === "energy" && "motion-safe:animate-pulse"
            )}
          >
            {hecho ? <Check className="size-5" aria-hidden /> : <Icon className="size-5" aria-hidden />}
          </span>
          {layout === "grid" && <PasoLabel n={n} hecho={hecho} sugerido={sugerido} />}
        </div>
        <div className="flex min-w-0 flex-col gap-1">
          {layout === "list" && <PasoLabel n={n} hecho={hecho} sugerido={sugerido} />}
          <h3 className={cn("font-semibold text-pretty", hecho && "text-muted-foreground line-through decoration-secondary/60")}>{paso.title}</h3>
          {!hecho && <p className="text-sm text-muted-foreground text-pretty">{paso.body}</p>}
        </div>
      </div>
      {paso.accion && !hecho && (
        <AccionButton accion={paso.accion} variant={actual ? "brand" : "outline"} className={cn(layout === "grid" ? "mt-auto w-full" : "w-full sm:w-auto")} />
      )}
    </li>
  );
}

function PasoLabel({ n, hecho, sugerido }: { n: number; hecho: boolean; sugerido: boolean }) {
  return (
    <span className="flex flex-wrap items-center gap-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
      Paso {n}
      {hecho ? (
        <span className="rounded-full bg-secondary/15 px-2 py-0.5 text-secondary normal-case">Listo</span>
      ) : (
        sugerido && <span className="rounded-full bg-energy/15 px-2 py-0.5 text-energy normal-case">Sugerido</span>
      )}
    </span>
  );
}

function AccionButton({ accion, variant, className }: { accion: GuiaAccion; variant: "brand" | "outline"; className?: string }) {
  if (accion.href) {
    return (
      <Button asChild variant={variant} className={className}>
        <Link href={accion.href} onClick={accion.onClick}>
          {accion.label}
        </Link>
      </Button>
    );
  }
  return (
    <Button variant={variant} className={className} onClick={accion.onClick}>
      {accion.label}
    </Button>
  );
}
