/** Catálogo de instituciones › áreas › carreras (tablas `instituciones`, `areas`, `carreras`). */

export type TipoInstitucion = "universidad" | "examen_especial";

export type Area = {
  id: string;
  institucionId: string;
  /** A1, A2… Segundo bloque del ID de reactivo. */
  codigo: string;
  nombre: string;
  activo: boolean;
  orden: number;
};

/** En un examen especial la "carrera" es la edición del examen (ej. "TOEFL 2026"). */
export type Carrera = {
  id: string;
  institucionId: string;
  areaId: string | null;
  nombre: string;
  activo: boolean;
  orden: number;
};

export type Institucion = {
  /** Slug estable: lo guardan student_goals e invites (ej. "unam"). */
  id: string;
  /** Prefijo de los IDs de reactivos (UNAM, TEC, TOEFL). */
  clave: string;
  nombre: string;
  tipo: TipoInstitucion;
  /** Nombre del examen de admisión cuando no es el genérico (TEC → PAA). */
  examen: string | null;
  /** Identidad visual (se edita aparte, ver features/identidad). */
  sigla: string;
  colorPrimario: string | null;
  colorSecundario: string | null;
  colorAcento: string | null;
  iconoSvg: string | null;
  logoUrl: string | null;
  activo: boolean;
  orden: number;
  areas: Area[];
  carreras: Carrera[];
};

export type InstitucionInput = Pick<Institucion, "clave" | "nombre" | "tipo" | "examen">;
export type AreaInput = Pick<Area, "codigo" | "nombre">;
export type CarreraInput = Pick<Carrera, "nombre" | "areaId">;
