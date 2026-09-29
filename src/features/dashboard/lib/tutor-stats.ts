/**
 * Métricas del panel de estadísticas a partir de los exámenes congelados. "Aciertos" = preguntas
 * correctas / preguntas del examen (del resumen por materia), igual que el reporte del alumno.
 */

import type { ExamType, TutorExam } from "../services/tutor-service";

export const EXAM_TYPES: { id: ExamType; label: string }[] = [
  { id: "plan", label: "Plan Programado" },
  { id: "libre", label: "Examen Libre" },
  { id: "racha", label: "Modo Racha" },
];

export const EXAM_TYPE_LABEL: Record<ExamType, string> = { plan: "Plan", libre: "Libre", racha: "Racha" };

type Tally = { correct: number; total: number };

const pct = (t: Tally) => (t.total > 0 ? Math.round((100 * t.correct) / t.total) : null);

function tallyOf(exam: TutorExam): Tally {
  if (exam.materias.length === 0) return { correct: 0, total: 0 };
  return exam.materias.reduce((t, m) => ({ correct: t.correct + m.correctas, total: t.total + m.total }), {
    correct: 0,
    total: 0,
  });
}

function add(a: Tally, b: Tally): Tally {
  return { correct: a.correct + b.correct, total: a.total + b.total };
}

export type ModeSummary = { type: ExamType; exams: number; accuracy: number | null };

export type WeekPoint = { weekStart: Date; accuracy: number | null; exams: number };

export type MateriaRow = { materia: string; byType: Record<ExamType, number | null>; overall: number; questions: number };

export type TutorStats = {
  exams: number;
  accuracy: number | null;
  hours: number;
  examsThisWeek: number;
  byMode: ModeSummary[];
  weeks: WeekPoint[];
  materias: MateriaRow[];
  strongest: MateriaRow | null;
  weakest: MateriaRow | null;
};

/** Lunes 00:00 (hora local) de la semana de la fecha. */
export function weekStartOf(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
}

// Una materia con menos preguntas que esto no se usa como "más fuerte" o "a reforzar": es poca evidencia.
const MIN_QUESTIONS = 5;

export function computeStats(exams: TutorExam[], weeksBack = 12, now = new Date()): TutorStats {
  let all: Tally = { correct: 0, total: 0 };
  const mode = new Map<ExamType, { exams: number; tally: Tally }>();
  const weeks = new Map<number, { exams: number; tally: Tally }>();
  const materias = new Map<string, { byType: Map<ExamType, Tally>; tally: Tally }>();
  const thisWeek = weekStartOf(now).getTime();
  let seconds = 0;
  let examsThisWeek = 0;

  for (const exam of exams) {
    const t = tallyOf(exam);
    all = add(all, t);
    seconds += exam.timeSpentSeconds;

    const m = mode.get(exam.type) ?? { exams: 0, tally: { correct: 0, total: 0 } };
    mode.set(exam.type, { exams: m.exams + 1, tally: add(m.tally, t) });

    const week = weekStartOf(new Date(exam.completedAt)).getTime();
    if (week === thisWeek) examsThisWeek++;
    const w = weeks.get(week) ?? { exams: 0, tally: { correct: 0, total: 0 } };
    weeks.set(week, { exams: w.exams + 1, tally: add(w.tally, t) });

    for (const s of exam.materias) {
      const row = materias.get(s.materia) ?? { byType: new Map(), tally: { correct: 0, total: 0 } };
      const st = { correct: s.correctas, total: s.total };
      row.tally = add(row.tally, st);
      row.byType.set(exam.type, add(row.byType.get(exam.type) ?? { correct: 0, total: 0 }, st));
      materias.set(s.materia, row);
    }
  }

  const weekPoints: WeekPoint[] = [];
  for (let i = weeksBack - 1; i >= 0; i--) {
    const start = new Date(thisWeek);
    start.setDate(start.getDate() - 7 * i);
    const w = weeks.get(start.getTime());
    weekPoints.push({ weekStart: start, accuracy: w ? pct(w.tally) : null, exams: w?.exams ?? 0 });
  }

  const materiaRows: MateriaRow[] = [...materias.entries()]
    .filter(([, r]) => r.tally.total > 0)
    .map(([materia, r]) => ({
      materia,
      overall: pct(r.tally) ?? 0,
      questions: r.tally.total,
      byType: {
        plan: r.byType.has("plan") ? pct(r.byType.get("plan")!) : null,
        libre: r.byType.has("libre") ? pct(r.byType.get("libre")!) : null,
        racha: r.byType.has("racha") ? pct(r.byType.get("racha")!) : null,
      },
    }))
    .sort((a, b) => b.overall - a.overall || a.materia.localeCompare(b.materia, "es"));

  const ranked = materiaRows.filter((r) => r.questions >= MIN_QUESTIONS);
  const strongest = ranked[0] ?? null;
  const weakest = ranked.length > 1 ? ranked[ranked.length - 1] : null;

  return {
    exams: exams.length,
    accuracy: pct(all),
    hours: seconds / 3600,
    examsThisWeek,
    byMode: EXAM_TYPES.map(({ id }) => ({
      type: id,
      exams: mode.get(id)?.exams ?? 0,
      accuracy: mode.has(id) ? pct(mode.get(id)!.tally) : null,
    })),
    weeks: weekPoints,
    materias: materiaRows,
    strongest,
    weakest,
  };
}

export const formatHours = (h: number) =>
  h < 1 ? `${Math.round(h * 60)} min` : `${h.toLocaleString("es-MX", { maximumFractionDigits: 1 })} h`;

/** Texto listo para pegar en WhatsApp (los *asteriscos* se ven en negritas). */
export function whatsappSummary(subject: string, stats: TutorStats, brand: string): string {
  const lines = [`📊 *Reporte ${brand} - ${subject}*`];
  if (stats.exams === 0) {
    lines.push("Aún no hay exámenes registrados.");
    return lines.join("\n");
  }
  lines.push(`Promedio general: ${stats.accuracy ?? 0}% de aciertos.`);
  if (stats.strongest) lines.push(`💪 Materia más fuerte: ${stats.strongest.materia} (${stats.strongest.overall}%).`);
  if (stats.weakest) lines.push(`🎯 Materia a reforzar: ${stats.weakest.materia} (${stats.weakest.overall}%).`);
  lines.push(`📝 Exámenes realizados esta semana: ${stats.examsThisWeek}.`);
  lines.push(`⏱️ Total: ${stats.exams} ${stats.exams === 1 ? "examen" : "exámenes"} · ${formatHours(stats.hours)} de práctica.`);
  return lines.join("\n");
}
