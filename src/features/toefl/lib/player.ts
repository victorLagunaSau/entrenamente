/** Contrato del <ToeflPlayer/>: lo usan el diagnóstico (fase 2) y práctica / plan / racha (fase 3). */

import type { McerLevel, Section } from "../types";

export type PlayerContext = {
  /** Id del asset: las preguntas que lo comparten comparten también las reproducciones del audio. */
  id: string;
  audioUrl: string | null;
  audioMaxPlays: number;
  readingPassage: string | null;
};

export type PlayerItem = {
  id: string;
  section: Section;
  mcerLevel: McerLevel;
  questionText: string;
  /** Sin ponderaciones: la base califica. Se muestran en el orden del manifest (A, B, C, D). */
  options: { id: string; texto: string }[];
  context: PlayerContext | null;
};

export type PlayerSheet = {
  /** En el orden del examen. */
  respuestas: { id: string; respuestaId: string | null; segundos: number }[];
  tiempoUsado: number;
  agotado: boolean;
};

export const LETTERS = ["A", "B", "C", "D", "E", "F"];

const pad = (n: number) => String(n).padStart(2, "0");
export const formatClock = (seconds: number) => {
  const s = Math.max(0, Math.ceil(seconds));
  return `${pad(Math.floor(s / 60))}:${pad(s % 60)}`;
};
