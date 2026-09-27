import type { Dificultad, Reactivo } from "@/features/exam/types";

export type Materia = { clave: string; nombre: string };

/** Reactivo guardado en el banco: el reactivo estándar + su clasificación. */
export type Pregunta = Reactivo & {
  /** Clave de la institución (UNAM, TOEFL…). */
  institucion: string;
  /** Clave de la materia (MAT, ESP…). */
  materia: string;
  /** Fuente general (configuracionExamen.fuente). */
  fuente: string;
  /** Ids de carreras del catálogo (tabla `carreras`), asignadas a mano: muchos a muchos. */
  destinos: string[];
  actualizado: string;
};

export type PreguntaDraft = Omit<Pregunta, "actualizado">;

/** Sin ID, institución y materia son obligatorias (ver lib/search). */
export type QuestionFilters = {
  query: string;
  institucion: string | null;
  materia: string | null;
  /** Carreras a las que debe estar asignada (una carrera, o todas las de un área). */
  carreras: string[] | null;
  dificultad: Dificultad | null;
};

export type SearchResult = {
  items: Pregunta[];
  total: number;
  page: number;
  pageCount: number;
};
