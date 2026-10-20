/**
 * Módulo TOEFL ITP: herramienta propia, fuera del catálogo de escuelas y del banco de admisión.
 * Llaves del manifest.json en camelCase (ver lib/manifest); en la base van en snake_case.
 */

import type { Ponderacion } from "@/features/exam/types";

export const AGE_RANGES = ["8_11_primary", "11_15_junior", "16_mas"] as const;
export type AgeRange = (typeof AGE_RANGES)[number];

export const AGE_RANGE_LABEL: Record<AgeRange, string> = {
  "8_11_primary": "8–11 · Primary",
  "11_15_junior": "11–15 · Junior",
  "16_mas": "16+",
};

export const MCER_LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;
export type McerLevel = (typeof MCER_LEVELS)[number];

export const SECTIONS = ["listening", "structure", "reading"] as const;
export type Section = (typeof SECTIONS)[number];

export const SECTION_LABEL: Record<Section, string> = {
  listening: "Listening",
  structure: "Structure",
  reading: "Reading",
};

export type ToeflOption = {
  id: string;
  texto: string;
  ponderacion: Ponderacion;
  /** Por qué se equivoca quien la elige; null en la correcta. */
  diagnosticoError_es: string | null;
  diagnosticoError_en: string | null;
};

/** Pregunta tal como la guarda la base (sin contexto embebido). */
export type ToeflQuestionRow = {
  id: string;
  seed_code: string;
  age_range: AgeRange;
  mcer_level: McerLevel;
  section: Section;
  context_key: string | null;
  question_text: string;
  options: ToeflOption[];
  step_by_step_explanation_es: string[];
  step_by_step_explanation_en: string[];
};

/** Audio o pasaje compartido por varias preguntas. */
export type ToeflAssetRow = {
  context_key: string;
  audio_key: string | null;
  audio_path: string | null;
  audio_url: string | null;
  audio_max_plays: number;
  reading_passage: string | null;
  transcription_audio: string | null;
};
