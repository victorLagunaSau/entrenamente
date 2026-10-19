"use client";

import { BookOpenCheck, Infinity as InfinityIcon, Route } from "lucide-react";

import { type GuiaPaso, StepGuide } from "@/features/guia";

/** Desplaza a una sección del home cuando el diálogo ya soltó el bloqueo de scroll. */
function irA(id: string) {
  window.setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" }), 250);
}

/** Guía de inicio del Demo (3 pasos): la ruta de exámenes gratis, la guía de errores y el plan ilimitado. */
export function DemoStartGuide({
  open,
  onOpenChange,
  total,
  used,
  meta,
  onUnlock,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Exámenes gratuitos que recibió el alumno. */
  total: number;
  used: number;
  /** "Derecho - UNAM", o null si aún no tiene meta. */
  meta: string | null;
  onUnlock: () => void;
}) {
  const para = meta ? `para ${meta}` : "para tu examen de admisión";
  const resto = total - 1;
  const ruta =
    used > 0
      ? `Ya llevas ${used} de ${total}. Cada examen que terminas desbloquea el siguiente.`
      : resto > 0
        ? `Completa tu primer examen para desbloquear ${resto === 1 ? "el siguiente" : `los siguientes ${resto}`}.`
        : "Complétalo para conocer tu nivel.";

  const pasos: GuiaPaso[] = [
    {
      id: "ruta",
      icon: Route,
      tone: "secondary",
      title: total === 1 ? "Tu examen gratis" : `Tu camino de ${total} exámenes gratis`,
      body: `Diagnostica tu nivel ${para}. ${ruta}`,
      accion: { label: "Ver mi ruta", onClick: () => irA("ruta") },
    },
    {
      id: "guia",
      icon: BookOpenCheck,
      tone: "brand",
      title: "Guía de errores",
      body: "En cada respuesta incorrecta te enseñaremos el paso a paso exacto para resolverla bien a la primera.",
    },
    {
      id: "ilimitado",
      icon: InfinityIcon,
      tone: "energy",
      title: "Desbloquea tu Plan Ilimitado",
      body: "Si quieres crear una agenda de examen con fecha límite o medir tu racha, activa tu Plan Estudiante en cualquier momento.",
      accion: { label: "Ver Plan Estudiante", onClick: onUnlock },
    },
  ];

  return (
    <StepGuide
      open={open}
      onOpenChange={onOpenChange}
      kicker="Guía de inicio"
      pasos={pasos}
      final={{ label: used > 0 ? "Seguir mi ruta" : "Empezar mi ruta", onClick: () => irA("ruta") }}
    />
  );
}
