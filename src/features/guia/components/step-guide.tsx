"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

import type { GuiaAccion, GuiaPaso, GuiaTone } from "../types";

const ICON_TONE: Record<GuiaTone, string> = {
  brand: "bg-primary/15 text-brand-light",
  secondary: "bg-secondary/15 text-secondary",
  energy: "bg-energy/15 text-energy",
};

/**
 * Guía de inicio en pasos (recorrido): un paso a la vez con su avance, Atrás/Siguiente y, al final, la acción
 * principal. Cada paso puede traer su propio atajo (`accion`), que cierra la guía y lleva a su sección.
 */
export function StepGuide({
  open,
  onOpenChange,
  kicker,
  pasos,
  final,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Línea pequeña sobre el título, p. ej. "Guía de inicio". */
  kicker: string;
  pasos: GuiaPaso[];
  /** Botón principal del último paso. */
  final: GuiaAccion;
}) {
  const [i, setI] = React.useState(0);
  React.useEffect(() => {
    if (open) setI(0);
  }, [open]);

  const paso = pasos[i];
  if (!paso) return null;
  const last = i === pasos.length - 1;
  const Icon = paso.icon;
  const close = () => onOpenChange(false);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby={`guia-${paso.id}-body`}>
        <div className="flex flex-col gap-2 pr-8">
          <p className="text-xs font-semibold tracking-wide text-brand-light uppercase">
            {kicker} · Paso {i + 1} de {pasos.length}
          </p>
          <div className="flex gap-1.5" role="progressbar" aria-valuemin={1} aria-valuemax={pasos.length} aria-valuenow={i + 1} aria-label="Avance de la guía">
            {pasos.map((p, n) => (
              <span
                key={p.id}
                className={cn("h-1.5 flex-1 rounded-full transition-colors", n <= i ? "bg-brand-gradient" : "bg-muted")}
              />
            ))}
          </div>
        </div>

        <DialogHeader className="items-start gap-3 pr-0">
          <span className={cn("grid size-12 place-items-center rounded-xl", ICON_TONE[paso.tone ?? "brand"])}>
            <Icon className="size-6" aria-hidden />
          </span>
          <DialogTitle>{paso.title}</DialogTitle>
          <DialogDescription id={`guia-${paso.id}-body`} className="text-base text-cool">
            {paso.body}
          </DialogDescription>
        </DialogHeader>

        {paso.accion && !last && <AccionButton accion={paso.accion} variant="link" className="h-auto w-fit p-0" onDone={close} />}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
          {i > 0 ? (
            <Button variant="ghost" onClick={() => setI(i - 1)}>
              <ArrowLeft aria-hidden /> Atrás
            </Button>
          ) : (
            <Button variant="ghost" onClick={close}>
              Saltar guía
            </Button>
          )}
          {last ? (
            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              {paso.accion && <AccionButton accion={paso.accion} variant="outline" onDone={close} />}
              <AccionButton accion={final} variant="brand" onDone={close} />
            </div>
          ) : (
            <Button variant="brand" onClick={() => setI(i + 1)}>
              Siguiente <ArrowRight aria-hidden />
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AccionButton({
  accion,
  variant,
  className,
  onDone,
}: {
  accion: GuiaAccion;
  variant: "brand" | "outline" | "link";
  className?: string;
  onDone: () => void;
}) {
  const run = () => {
    onDone();
    accion.onClick?.();
  };
  if (accion.href) {
    return (
      <Button asChild variant={variant} className={className}>
        <Link href={accion.href} onClick={run}>
          {accion.label}
        </Link>
      </Button>
    );
  }
  return (
    <Button variant={variant} className={className} onClick={run}>
      {accion.label}
    </Button>
  );
}
