import type { Institucion } from "@/features/escuelas/types";
import type { Dificultad } from "@/features/exam/types";

import type { Materia } from "../types";

/** Materias base; el importador puede registrar nuevas (clave del ID + nombre del JSON). */
export const MATERIAS_BASE: Materia[] = [
  { clave: "MAT", nombre: "Matemáticas" },
  { clave: "FIS", nombre: "Física" },
  { clave: "QUI", nombre: "Química" },
  { clave: "BIO", nombre: "Biología" },
  { clave: "ESP", nombre: "Español" },
  { clave: "LIT", nombre: "Literatura" },
  { clave: "HIM", nombre: "Historia de México" },
  { clave: "HIU", nombre: "Historia Universal" },
  { clave: "GEO", nombre: "Geografía" },
  { clave: "FIL", nombre: "Filosofía" },
  { clave: "ING", nombre: "Inglés" },
];

export const DIFICULTADES: { value: Dificultad; nombre: string; tone: string }[] = [
  { value: "facil", nombre: "Fácil", tone: "bg-secondary/15 text-secondary" },
  { value: "media", nombre: "Media", tone: "bg-primary/15 text-brand-light" },
  { value: "dificil", nombre: "Difícil", tone: "bg-energy/15 text-energy" },
];

/** Segundos del temporizador del reactivo según dificultad. */
export const SECONDS_BY_DIFICULTAD: Record<Dificultad, number> = { facil: 60, media: 90, dificil: 150 };

export const dificultadOf = (value: Dificultad) => DIFICULTADES.find((d) => d.value === value);

/* ──────────────── Catálogo de escuelas (Supabase, módulo /admin/escuelas) ──────────────── */

/** Institución por su clave (primer bloque del ID del reactivo: UNAM, TEC, TOEFL). */
export const findInstitucion = (cat: Institucion[], clave: string) => cat.find((i) => i.clave === clave) ?? null;

/** Carrera por id con su institución y su área (si tiene). */
export function findCarrera(cat: Institucion[], id: string) {
  for (const inst of cat) {
    const carrera = inst.carreras.find((c) => c.id === id);
    if (carrera) return { inst, carrera, area: inst.areas.find((a) => a.id === carrera.areaId) ?? null };
  }
  return null;
}

/** "Actuaría (A1)" o el id si ya no está en el catálogo. */
export function carreraNombre(cat: Institucion[], id: string) {
  const hit = findCarrera(cat, id);
  return hit ? `${hit.carrera.nombre}${hit.area ? ` (${hit.area.codigo})` : ""}` : id;
}

/**
 * Carreras que sugiere `configuracionExamen.areaCarrera` para preseleccionar:
 * "A1 - Ciencias…" → todas las carreras del área A1; si no es un área, la carrera con ese nombre.
 */
export function carrerasSugeridas(inst: Institucion, areaCarrera: string): string[] {
  const codigo = areaCarrera.split(" - ")[0]?.trim().toUpperCase();
  const area = inst.areas.find((a) => a.codigo.toUpperCase() === codigo);
  if (area) return inst.carreras.filter((c) => c.areaId === area.id).map((c) => c.id);
  const nombre = areaCarrera.trim().toLowerCase();
  return inst.carreras.filter((c) => c.nombre.toLowerCase() === nombre).map((c) => c.id);
}

/* ─────────────────────────── ID del reactivo ─────────────────────────── */

/** [INSTITUCIÓN]-[ÁREA/MÓDULO]-[MATERIA]-[NÚMERO_RAÍZ]-V[VERSIÓN] */
export const ID_PATTERN = /^([A-Z0-9]+)-([A-Z0-9]+)-([A-Z]{2,4})-(\d{3,4})-V(\d{2,3})$/;

export function parseId(id: string) {
  const m = ID_PATTERN.exec(id);
  return m ? { institucion: m[1], area: m[2], materia: m[3], raiz: m[4], version: `V${m[5]}` } : null;
}

/** Pregunta raíz que agrupa las variantes: UNAM-A1-MAT-007-V03 → UNAM-A1-MAT-007. */
export const grupoDe = (id: string) => id.replace(/-V\d+$/, "");
