/** Identidad visual de una institución (columnas de identidad de `instituciones`). */
export type Identidad = {
  /** Slug estable (unam). */
  id: string;
  /** Prefijo de reactivos (UNAM); los exámenes congelados identifican a la institución por esta clave. */
  clave: string;
  /** Lo que ve el usuario (UNAM, CU…). */
  sigla: string;
  nombre: string;
  tipo: "universidad" | "examen_especial";
  /** Examen de admisión cuando no es el genérico (PAA). */
  examen: string | null;
  colorPrimario: string | null;
  colorSecundario: string | null;
  colorAcento: string | null;
  /** Vector lineal en blanco. Se pinta como máscara CSS (ver SchoolIcon). */
  iconoSvg: string | null;
  logoUrl: string | null;
  activo: boolean;
  orden: number;
};

export type IdentidadInput = Pick<
  Identidad,
  "sigla" | "colorPrimario" | "colorSecundario" | "colorAcento" | "iconoSvg" | "logoUrl"
>;
