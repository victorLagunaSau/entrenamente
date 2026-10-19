import type { LucideIcon } from "lucide-react";

export type GuiaTone = "brand" | "secondary" | "energy";

/** Acción de un paso: ir a una ruta o sección (`href`) o hacer algo en la página (`onClick`). */
export type GuiaAccion = { label: string; href?: string; onClick?: () => void };

/**
 * Un paso de una guía de inicio. Solo describe qué hacer y a dónde ir: no se ancla a elementos de la
 * pantalla, así la guía sigue sirviendo aunque cambie el diseño de cada home.
 */
export type GuiaPaso = {
  id: string;
  icon: LucideIcon;
  tone?: GuiaTone;
  title: string;
  body: string;
  accion?: GuiaAccion;
  /** Para las guías con avance real (checklist); en un recorrido no se usa. */
  hecho?: boolean;
};
