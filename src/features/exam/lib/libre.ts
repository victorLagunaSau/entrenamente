/**
 * Examen Libre: volumen por nivel, modos de vista y tipos del examen en curso y del historial congelado.
 */

import { type Dificultad, SECONDS_BY_DIFICULTAD } from "../types";

export type Nivel = Dificultad;

export const NIVELES: { value: Nivel; nombre: string; detalle: string; volumen: [number, number] }[] = [
  { value: "facil", nombre: "Fácil", detalle: "Dominio de preguntas fáciles con relleno de nivel medio.", volumen: [50, 70] },
  { value: "media", nombre: "Medio", detalle: "Dominio de preguntas medias con relleno de nivel fácil.", volumen: [70, 100] },
  { value: "dificil", nombre: "Difícil (Pro)", detalle: "Dominio de preguntas difíciles con relleno de nivel medio.", volumen: [100, 140] },
];

/**
 * ⚠️ Temporal: el botón "Prueba" de cada nivel arma un examen corto para probar la interfaz rápido.
 * Quitar junto con el botón cuando ya no haga falta.
 */
export const PRUEBA_VOLUMEN: [number, number] = [5, 10];

export const volumenDe = (nivel: Nivel, prueba = false) => (prueba ? PRUEBA_VOLUMEN : NIVELES.find((n) => n.value === nivel)!.volumen);

/** Número de preguntas a pedir: al azar dentro del volumen del nivel (o del de prueba). */
export function pickTotal(nivel: Nivel, prueba = false) {
  const [min, max] = volumenDe(nivel, prueba);
  return min + Math.floor(Math.random() * (max - min + 1));
}

/** Tiempo total del examen: la suma del tiempo de cada reactivo según su dificultad. */
export const timeLimitOf = (items: { dificultad: Dificultad }[]) =>
  items.reduce((sum, q) => sum + SECONDS_BY_DIFICULTAD[q.dificultad], 0);

/* ─────────────────────────── Modos de vista ─────────────────────────── */

export type ViewMode = "scroll" | "paginado" | "enfoque";
export const PAGE_SIZE = 5;

export const VIEW_MODES: { value: ViewMode; nombre: string; corto: string }[] = [
  { value: "enfoque", nombre: "Pregunta a pregunta", corto: "Pregunta" },
  { value: "paginado", nombre: `Paginado (${PAGE_SIZE})`, corto: `De ${PAGE_SIZE}` },
  { value: "scroll", nombre: "Scroll continuo", corto: "Scroll" },
];

/* ─────────────────────────── Examen en curso ─────────────────────────── */

/** Reactivo tal como llega al alumno: sin ponderaciones, diagnósticos ni solución (se califica en la base). */
export type ExamItem = {
  codigo: string;
  materia: string;
  materiaNombre: string;
  dificultad: Dificultad;
  valorPuntos: number;
  lectura: string | null;
  pregunta: string;
  respuestas: { id: number; texto: string }[];
};

/** Institución y carrera elegidas: también definen la mimetización visual del examen. */
export type ExamTarget = {
  institucion: { id: string; clave: string; nombre: string; colorId: string | null };
  carrera: { id: string; nombre: string; area: string | null };
};

export type ExamConfig = ExamTarget & { nivel: Nivel; prueba?: boolean };

/* ─────────────────────────── Historial congelado ─────────────────────────── */

export type SnapshotQuestion = {
  id_original: string;
  materia: string;
  materia_clave: string;
  dificultad: Dificultad;
  valor_puntos: number;
  fuente_detallada: string;
  lectura: string | null;
  pregunta: string;
  respuestas: { id: number; texto: string; ponderacion: number; diagnosticoError: string | null }[];
  /** Ids de respuesta en el orden en que las vio el alumno (letras A, B, C…). */
  orden_opciones: number[];
  respuesta_seleccionada_id: number | null;
  ponderacion_obtenida: number;
  diagnostico_error: string | null;
  solucion_paso_a_paso: string[];
  tiempo_respuesta_segundos: number;
};

export type MateriaSummary = {
  materia: string;
  materia_clave: string;
  total: number;
  correctas: number;
  parciales: number;
  incorrectas: number;
  sin_responder: number;
  puntos: number;
  maximo: number;
  porcentaje_aciertos: number;
};

/** Fila de `exam_history`: fotografía inmutable del examen tal como se respondió. */
export type ExamRecord = {
  id: number;
  /** Identificador para compartir y consultar (EM-7F3K-9Q2D). */
  folio: string;
  examType: "libre" | "plan" | "racha";
  universityKey: string;
  universityName: string;
  careerName: string;
  level: Nivel;
  totalQuestions: number;
  answeredQuestions: number;
  score: number;
  maxScore: number;
  timeLimitSeconds: number;
  timeSpentSeconds: number;
  timedOut: boolean;
  completedAt: string;
  target: ExamTarget;
  materias: MateriaSummary[];
  questions: SnapshotQuestion[];
};

/* ─────────────────────────── Formato ─────────────────────────── */

const pad = (n: number) => String(n).padStart(2, "0");

/** 01:45:20 (o 04:05 si no llega a una hora y `compact`). */
export function formatClock(total: number, compact = false) {
  const s = Math.max(0, Math.floor(total));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return compact && h === 0 ? `${pad(m)}:${pad(s % 60)}` : `${pad(h)}:${pad(m)}:${pad(s % 60)}`;
}

/** "Preguntas 4 y 8", "Preguntas 1, 3 y 9", "Pregunta 5". */
export function listNumbers(nums: number[]) {
  if (nums.length === 1) return `Pregunta ${nums[0]}`;
  return `Preguntas ${nums.slice(0, -1).join(", ")} y ${nums[nums.length - 1]}`;
}

/** Barra y acento del tema institucional (lib/uni-theme); fuera del tema, el azul de marca. */
export const UNI_BAR = "var(--uni-bar, var(--primary))";
export const UNI_ACCENT = "var(--uni-accent, var(--primary))";
