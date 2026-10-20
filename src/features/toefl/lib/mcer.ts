import type { McerLevel } from "../types";

/** Nombre y descripción corta de cada nivel del Marco Común Europeo (MCER / CEFR). */
export const MCER_INFO: Record<McerLevel, { nombre: string; descripcion: string }> = {
  A1: { nombre: "A1 · Principiante", descripcion: "Entiendes frases básicas y expresiones de uso diario." },
  A2: { nombre: "A2 · Elemental", descripcion: "Te comunicas en situaciones sencillas y conocidas." },
  B1: { nombre: "B1 · Intermedio", descripcion: "Entiendes lo principal de textos y conversaciones claras." },
  B2: { nombre: "B2 · Intermedio alto", descripcion: "Comprendes textos complejos y conversas con fluidez." },
  C1: { nombre: "C1 · Avanzado", descripcion: "Usas el inglés con soltura en contextos académicos." },
  C2: { nombre: "C2 · Maestría", descripcion: "Comprendes prácticamente todo lo que lees y escuchas." },
};
