/**
 * TEMPORAL (prototipo "Simular cuenta pagada"): datos de ejemplo para aprobar el diseño del panel pagado.
 * Un segundo estudiante, historial de exámenes (plan, libre y racha), metas y planes de estudio. Todo se calcula
 * en el navegador a partir del estudiante real; no toca la base. Se borra junto con el switch.
 */

import type { Nivel } from "@/features/exam/lib/libre";
import { addDays, DIAS, type DayKey, type StudentPlan, toISODate, todayISO, weekdayIndex } from "@/features/plan/lib/plan";

import type { ExamType, MateriaSummary, TutorExam, TutorStudent } from "../services/tutor-service";

/** Una meta del estudiante: carrera + universidad (student_goals ya admite varias). */
export type StudentGoal = { careerId: string; career: string; universityId: string; university: string; main: boolean };

export const SAMPLE_STUDENT: TutorStudent = {
  id: "muestra-viktoria",
  alias: "Viktoria",
  fullName: "Viktoria Laguna",
  groupId: null,
  linkedAt: new Date(Date.now() - 40 * 86_400_000).toISOString(),
  career: "Arquitectura",
  university: "UNAM",
  active: true,
  access: "tutor",
  registeredAt: new Date(Date.now() - 42 * 86_400_000).toISOString(),
  trial: null,
};

export const SAMPLE_STUDENT_2: TutorStudent = {
  ...SAMPLE_STUDENT,
  id: "muestra-emiliano",
  alias: "Emiliano",
  fullName: "Emiliano Laguna",
  career: "Ingeniería en Sistemas Computacionales",
  university: "IPN",
  linkedAt: new Date(Date.now() - 20 * 86_400_000).toISOString(),
  registeredAt: new Date(Date.now() - 21 * 86_400_000).toISOString(),
};

export const SAMPLE_IDS = new Set([SAMPLE_STUDENT.id, SAMPLE_STUDENT_2.id]);

const MATERIAS = ["Matemáticas", "Física", "Química", "Biología", "Español", "Historia", "Geografía", "Literatura", "Filosofía"];

/** Perfil de cada estudiante de ejemplo: de dónde arranca, cuánto mejora y qué materias le cuestan. */
type Profile = { start: number; gain: number; streak: number; playedToday: boolean; skill: Record<string, number> };

function profileOf(student: TutorStudent): Profile {
  const r = rng(student.id);
  if (student.id === SAMPLE_STUDENT.id) {
    return { start: 64, gain: 20, streak: 12, playedToday: true, skill: { Matemáticas: 12, Física: 6, Historia: -14, Química: -6 } };
  }
  if (student.id === SAMPLE_STUDENT_2.id) {
    return { start: 55, gain: 12, streak: 2, playedToday: false, skill: { Matemáticas: 10, Física: 8, Español: -12, Literatura: -10 } };
  }
  return {
    start: 42 + Math.round(r() * 6),
    gain: 22,
    streak: 4,
    playedToday: false,
    skill: { Español: 14, Literatura: 8, Matemáticas: -16, Física: -10 },
  };
}

/** Metas de ejemplo: la del registro y, en la estudiante de muestra, una segunda opción. */
export function sampleGoals(student: TutorStudent): StudentGoal[] {
  const main: StudentGoal = {
    careerId: `${student.id}-main`,
    career: student.career ?? "Arquitectura",
    universityId: (student.university ?? "UNAM").toLowerCase(),
    university: student.university ?? "UNAM",
    main: true,
  };
  if (student.id !== SAMPLE_STUDENT.id) return [main];
  return [main, { careerId: "uam-diseno", career: "Diseño de la Comunicación Gráfica", universityId: "uam", university: "UAM", main: false }];
}

const TYPE_SHAPE: Record<ExamType, { questions: number; secondsPerQ: number }> = {
  plan: { questions: 40, secondsPerQ: 70 },
  libre: { questions: 120, secondsPerQ: 75 },
  racha: { questions: 18, secondsPerQ: 25 },
};

/** Historial de ~5 semanas: plan lunes/miércoles/viernes, un libre los sábados y racha diaria. */
export function sampleExams(student: TutorStudent, goals: StudentGoal[]): TutorExam[] {
  const p = profileOf(student);
  const r = rng(`${student.id}:exams`);
  const today = todayISO();
  const span = 34;
  const out: TutorExam[] = [];
  let seq = hash(student.id) % 10_000;

  const push = (type: ExamType, date: string, hour: number, goal: StudentGoal) => {
    const progress = 1 - daysAgo(date, today) / span;
    const base = p.start + p.gain * progress + (r() - 0.5) * 10 + (type === "racha" ? 4 : type === "libre" ? -4 : 0);
    const shape = TYPE_SHAPE[type];
    const materias = spread(shape.questions, type === "racha" ? 9 : MATERIAS.length).map(
      (total, i): MateriaSummary => {
        const acc = clamp(base + (p.skill[MATERIAS[i]] ?? 0) + (r() - 0.5) * 12, 5, 98) / 100;
        return { materia: MATERIAS[i], total, correctas: Math.round(total * acc) };
      }
    );
    const correct = materias.reduce((n, m) => n + m.correctas, 0);
    const completed = new Date(`${date}T${String(hour).padStart(2, "0")}:${String(Math.floor(r() * 50)).padStart(2, "0")}:00`);
    out.push({
      id: -(++seq),
      studentId: student.id,
      folio: `EM-MUES-${String(seq).padStart(4, "0")}`,
      type,
      pruebaNumero: null,
      universityKey: goal.university,
      careerName: goal.career,
      level: levelFor(correct / shape.questions),
      totalQuestions: shape.questions,
      answeredQuestions: shape.questions - Math.floor(r() * 3),
      score: correct,
      maxScore: shape.questions,
      timeSpentSeconds: Math.round(shape.questions * shape.secondsPerQ * (0.8 + r() * 0.3)),
      completedAt: completed.toISOString(),
      materias,
    });
  };

  for (let d = span; d >= 0; d--) {
    const date = addDays(today, -d);
    const weekday = DIAS[weekdayIndex(date)].key;
    const isToday = d === 0;
    // Racha: los últimos `streak` días seguidos (hoy solo si ya jugó) y días sueltos antes.
    const inStreak = d < p.streak + (p.playedToday ? 0 : 1) && !(isToday && !p.playedToday);
    if (inStreak || (d > p.streak + 1 && r() < 0.45)) push("racha", date, 20, goals[0]);
    if (!isToday && PLAN_DAYS.includes(weekday)) push("plan", date, 17, goals[0]);
    if (weekday === "saturday") push("libre", date, 11, goals[d % 14 < 7 && goals[1] ? 1 : 0]);
  }
  return out.sort((a, b) => a.completedAt.localeCompare(b.completedAt));
}

const PLAN_DAYS: DayKey[] = ["monday", "wednesday", "friday"];

/** Plan de estudio de ejemplo por meta: sesiones pasadas presentadas (con los exámenes "plan") y las que faltan. */
export function samplePlans(student: TutorStudent, goals: StudentGoal[], exams: TutorExam[]): StudentPlan[] {
  const today = todayISO();
  const planExams = exams.filter((e) => e.type === "plan" && e.id < 0);
  return goals.slice(0, 2).map((goal, gi) => {
    const created = addDays(today, gi === 0 ? -34 : -10);
    const official = addDays(today, gi === 0 ? 58 : 96);
    return buildPlan({
      id: -(hash(student.id + gi) % 100_000),
      goal,
      created,
      official,
      days: gi === 0 ? PLAN_DAYS : ["tuesday", "thursday"],
      perDay: 1,
      window: gi === 0 ? "16:00-18:00" : "19:00-21:00",
      exams: gi === 0 ? planExams : [],
    });
  });
}

/** Arma un plan (sesiones del día de alta al día anterior al examen). También sirve para "Crear plan" del prototipo. */
export function buildPlan({
  id,
  goal,
  created,
  official,
  days,
  perDay,
  window,
  level = null,
  exams = [],
}: {
  id: number;
  goal: StudentGoal;
  created: string;
  official: string;
  days: DayKey[];
  perDay: number;
  window: string;
  level?: Nivel | null;
  exams?: TutorExam[];
}): StudentPlan {
  const byDate = new Map(exams.map((e) => [toISODate(new Date(e.completedAt)), e]));
  const today = todayISO();
  const sessions: StudentPlan["sessions"] = [];
  let sid = Math.abs(id) * 1000;
  for (let d = created; d < official; d = addDays(d, 1)) {
    if (!days.includes(DIAS[weekdayIndex(d)].key)) continue;
    for (let k = 0; k < perDay; k++) {
      const e = k === 0 && d < today ? byDate.get(d) : undefined;
      sessions.push({
        id: ++sid,
        date: d,
        kind: "regular",
        status: e ? "completado" : "pendiente",
        exam: e
          ? { id: e.id, folio: e.folio, level: e.level, score: Math.round((100 * e.score) / e.maxScore), completedAt: e.completedAt }
          : null,
      });
    }
  }
  return {
    id,
    careerId: goal.careerId,
    universityKey: goal.university,
    careerName: goal.career,
    officialDate: official,
    practiceDays: days,
    examsPerDay: perDay,
    difficultyMode: level ? "fixed" : "automatic",
    fixedLevel: level,
    timeWindow: window,
    createdAt: new Date(`${created}T12:00:00`).toISOString(),
    sessions,
  };
}

/* ─────────────────────────── Utilidades ─────────────────────────── */

const clamp = (n: number, a: number, b: number) => Math.min(Math.max(n, a), b);

const daysAgo = (date: string, today: string) =>
  Math.round((new Date(`${today}T12:00:00`).getTime() - new Date(`${date}T12:00:00`).getTime()) / 86_400_000);

const levelFor = (ratio: number): Nivel => (ratio >= 0.8 ? "dificil" : ratio >= 0.6 ? "media" : "facil");

/** Reparte `total` preguntas entre `n` materias (las primeras reciben el sobrante). */
function spread(total: number, n: number) {
  const base = Math.floor(total / n);
  return Array.from({ length: n }, (_, i) => base + (i < total - base * n ? 1 : 0));
}

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Pseudoaleatorio con semilla: el ejemplo sale igual en cada carga. */
function rng(seed: string) {
  let a = hash(seed);
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
