/**
 * Reactivo en el formato estándar del banco (mismas llaves que el JSON de ingesta).
 * Los textos pueden llevar fórmulas LaTeX entre (form)…(/form): ver lib/form-tags.
 */

export type Dificultad = "facil" | "media" | "dificil";

/** Segundos por reactivo según dificultad (temporizador del reactivo y tiempo total del examen). */
export const SECONDS_BY_DIFICULTAD: Record<Dificultad, number> = { facil: 60, media: 90, dificil: 150 };

/** 1.0 correcta · 0.75 / 0.5 / 0.25 parcial · 0.0 error grave. */
export const PONDERACIONES = [1, 0.75, 0.5, 0.25, 0] as const;
export type Ponderacion = (typeof PONDERACIONES)[number];

export type Respuesta = {
  id: number;
  texto: string;
  ponderacion: Ponderacion;
  /** Por qué se equivocó quien elige esta opción; null en la correcta. */
  diagnosticoError: string | null;
};

export type Reactivo = {
  /** [INSTITUCIÓN]-[ÁREA]-[MATERIA]-[RAÍZ]-V[VERSIÓN], ej. UNAM-A1-MAT-007-V03. */
  id: string;
  fuenteDetallada: string;
  valorPuntos: number;
  dificultad: Dificultad;
  /** Texto largo previo (comprensión lectora, TOEFL); null si no aplica. */
  lecturaAsociada: string | null;
  pregunta: string;
  respuestas: Respuesta[];
  solucionPasoAPaso: string[];
  /** Versiones hermanas del mismo concepto (el motor no las repite al alumno). */
  variantesAsociadas: string[];
};

/** Resultado de un reactivo: `respuestaId` null = se agotó el tiempo sin responder. */
export type AnswerResult = { respuestaId: number | null; ponderacion: number; elapsedSeconds: number };

export const formatScore = (score: number) => (Number.isInteger(score) ? score.toFixed(1) : String(score));
