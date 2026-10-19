"use client";

import * as React from "react";
import { CalendarDays, Flame, NotebookPen } from "lucide-react";

import { type GuiaPaso, OnboardingChecklist, useGuiaPedida, useGuiaVista } from "@/features/guia";

/**
 * Guía de inicio del Estudiante Pro: plan por fecha oficial (sugerido), un examen libre y la racha. Cada paso
 * se marca solo con lo que ya hizo el alumno; desaparece al completar los 3 o si la oculta, y vuelve desde el
 * menú de cuenta ("Guía de uso").
 */
export function ProStartGuide({
  userId,
  tienePlan,
  hizoLibre,
  hizoRacha,
  canCreatePlan,
  onCreatePlan,
  libreHref,
  onRacha,
}: {
  userId: string;
  tienePlan: boolean;
  hizoLibre: boolean;
  hizoRacha: boolean;
  canCreatePlan: boolean;
  onCreatePlan: () => void;
  libreHref: string;
  onRacha: () => void;
}) {
  const { vista: oculta, marcarVista } = useGuiaVista("pro", userId);
  // Desde el menú "Guía de uso" se vuelve a mostrar aunque esté oculta o completa.
  const [pedida, setPedida] = React.useState(false);
  useGuiaPedida(() => {
    setPedida(true);
    window.setTimeout(() => document.getElementById("guia-inicio")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  }, true);
  const ocultar = () => {
    setPedida(false);
    marcarVista();
  };
  if (!pedida && (oculta !== false || (tienePlan && hizoLibre && hizoRacha))) return null;

  const pasos: GuiaPaso[] = [
    {
      id: "plan",
      icon: CalendarDays,
      tone: "brand",
      title: "Configura tu plan por fecha oficial",
      body: "¡Inicia con el pie derecho! Configura la fecha de tu examen oficial para que el sistema programe automáticamente tu calendario de práctica.",
      accion: canCreatePlan ? { label: "Configurar plan", onClick: onCreatePlan } : undefined,
      hecho: tienePlan,
    },
    {
      id: "libre",
      icon: NotebookPen,
      tone: "secondary",
      title: "Ponte a prueba con un examen libre",
      body: "¿Tienes tiempo libre o ganas de medir tu conocimiento en una materia específica? Inicia un examen libre sin restricciones.",
      accion: { label: "Probar ahora", href: libreHref },
      hecho: hizoLibre,
    },
    {
      id: "racha",
      icon: Flame,
      tone: "energy",
      title: "Mantén tu hábito diario con tu racha",
      body: "Entrena solo 10 minutos al día para mantener tu racha activa y asegurar tu retención a largo plazo.",
      accion: { label: "Activar racha", onClick: onRacha },
      hecho: hizoRacha,
    },
  ];

  return <OnboardingChecklist title="Tus primeros pasos de alto rendimiento" pasos={pasos} layout="grid" sugerido="plan" onDismiss={ocultar} />;
}
