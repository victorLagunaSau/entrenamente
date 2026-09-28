/**
 * Examen Racha: micro examen tipo trivia (2 preguntas por materia). Mismo historial y calificación que el
 * Examen Libre (exam_history, exam_type = 'racha'); solo cambia la interfaz.
 * El nivel no se elige: lo decide la base con el último examen racha de la carrera (nivel_racha()).
 */

import type { Nivel } from "./libre";

/** Aprobar = ≥ 70 % de los puntos. Mismo umbral que nivel_racha() en la migración 20260928000000. */
export const RACHA_APRUEBA = 0.7;

export const NIVEL_ORDEN: Nivel[] = ["facil", "media", "dificil"];

export const NIVEL_JUEGO: Record<Nivel, { nombre: string; paso: number }> = {
  facil: { nombre: "Fácil", paso: 1 },
  media: { nombre: "Medio", paso: 2 },
  dificil: { nombre: "Difícil", paso: 3 },
};

/** Nivel de la siguiente racha según cómo te fue en esta. */
export function siguienteNivel(nivel: Nivel, score: number, max: number): Nivel {
  const i = NIVEL_ORDEN.indexOf(nivel);
  const aprobo = max > 0 && score / max >= RACHA_APRUEBA;
  return NIVEL_ORDEN[Math.min(2, Math.max(0, i + (aprobo ? 1 : -1)))];
}

/** Dirección del cambio de nivel: "sube", "baja" o "igual" (tope arriba o piso abajo). */
export function cambioNivel(de: Nivel, a: Nivel) {
  const d = NIVEL_ORDEN.indexOf(a) - NIVEL_ORDEN.indexOf(de);
  return d > 0 ? "sube" : d < 0 ? "baja" : "igual";
}

/** Días seguidos con al menos una racha, contando hasta hoy (o hasta ayer si hoy aún no juega). */
export function diasDeRacha(fechas: string[], hoy = new Date()) {
  const dias = new Set(fechas.map((f) => diaLocal(new Date(f))));
  const cursor = new Date(hoy);
  const jugoHoy = dias.has(diaLocal(cursor));
  if (!jugoHoy) cursor.setDate(cursor.getDate() - 1);
  let n = 0;
  while (dias.has(diaLocal(cursor))) {
    n++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return { dias: n, jugoHoy };
}

const diaLocal = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
