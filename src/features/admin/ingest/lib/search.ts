import type { QuestionFilters } from "../types";

/** ID completo del reactivo, ej. UNAM-A1-MAT-007-V03. */
const ID_QUERY = /^[A-Z0-9]+-[A-Z0-9]+-[A-Z]{2,4}-\d{3,4}-V\d{2,3}$/i;

export const isIdQuery = (query: string) => ID_QUERY.test(query.trim());

/** Filtros obligatorios cuando no se busca por ID (evitan consultas costosas al banco). */
const REQUIRED: { key: "institucion" | "materia"; label: string }[] = [
  { key: "institucion", label: "institución" },
  { key: "materia", label: "materia" },
];

export const missingFilters = (f: QuestionFilters) => REQUIRED.filter((r) => !f[r.key]).map((r) => r.label);

/**
 * "id": consulta directa por ID (ignora filtros). "filters": institución + materia
 * (carrera/área, dificultad y tema son opcionales). null: no se permite consultar.
 */
export function searchMode(f: QuestionFilters): "id" | "filters" | null {
  if (isIdQuery(f.query)) return "id";
  return missingFilters(f).length === 0 ? "filters" : null;
}
