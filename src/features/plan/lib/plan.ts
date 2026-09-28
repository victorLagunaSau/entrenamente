/**
 * Examen Plan: plan personalizado por carrera con fecha límite. Mismo examen, calificación e historial que el
 * Examen Libre (exam_history, exam_type = 'plan'); lo propio del plan es la agenda (plan_sessions) y la dificultad.
 * Migración: 20260928010000_examen_plan.sql.
 */

import type { Nivel } from "@/features/exam/lib/libre";

/* ─────────────────────────── Configuración ─────────────────────────── */

export type DayKey = "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday";

/** Lunes primero (como en crear_plan: isodow 1 = lunes). */
export const DIAS: { key: DayKey; corto: string; abrev: string; nombre: string }[] = [
  { key: "monday", corto: "L", abrev: "Lun", nombre: "Lunes" },
  { key: "tuesday", corto: "M", abrev: "Mar", nombre: "Martes" },
  { key: "wednesday", corto: "X", abrev: "Mié", nombre: "Miércoles" },
  { key: "thursday", corto: "J", abrev: "Jue", nombre: "Jueves" },
  { key: "friday", corto: "V", abrev: "Vie", nombre: "Viernes" },
  { key: "saturday", corto: "S", abrev: "Sáb", nombre: "Sábado" },
  { key: "sunday", corto: "D", abrev: "Dom", nombre: "Domingo" },
];

export const MAX_POR_DIA = 3;
/** El plan cubre hasta 18 meses (mismo tope que crear_plan). */
export const MAX_DIAS_PLAN = 540;

export type DifficultyMode = "automatic" | "fixed";

export const HORARIOS: { value: string; nombre: string }[] = [
  { value: "07:00-09:00", nombre: "Mañana" },
  { value: "12:00-14:00", nombre: "Mediodía" },
  { value: "16:00-18:00", nombre: "Tarde" },
  { value: "19:00-21:00", nombre: "Noche" },
];

export type PlanDraft = {
  careerId: string;
  officialDate: string;
  practiceDays: DayKey[];
  examsPerDay: number;
  difficultyMode: DifficultyMode;
  fixedLevel: Nivel | null;
  timeWindow: string;
};

/**
 * Exámenes por día recomendados según los días que faltan para el examen oficial:
 * 30 o más → 1 (tranquilo), 15 a 29 → 2 (apúrate), menos de 15 → 3 (urgente).
 */
export type Urgencia = "tranquilo" | "apurado" | "urgente";

export function recomendacionPorDia(diasRestantes: number): { porDia: number; urgencia: Urgencia } {
  if (diasRestantes < 15) return { porDia: 3, urgencia: "urgente" };
  if (diasRestantes < 30) return { porDia: 2, urgencia: "apurado" };
  return { porDia: 1, urgencia: "tranquilo" };
}

/* ─────────────────────────── Plan guardado ─────────────────────────── */

export type PlanExam = { id: number; folio: string; level: Nivel; score: number; completedAt: string };

export type PlanSession = {
  id: number;
  /** YYYY-MM-DD */
  date: string;
  kind: "regular" | "refuerzo";
  status: "pendiente" | "completado";
  exam: PlanExam | null;
};

export type StudentPlan = {
  id: number;
  careerId: string;
  universityKey: string;
  careerName: string;
  officialDate: string;
  practiceDays: DayKey[];
  examsPerDay: number;
  difficultyMode: DifficultyMode;
  fixedLevel: Nivel | null;
  timeWindow: string;
  createdAt: string;
  /** Por fecha y luego por orden de alta. */
  sessions: PlanSession[];
};

/* ─────────────────────────── Fechas (día local, YYYY-MM-DD) ─────────────────────────── */

const pad = (n: number) => String(n).padStart(2, "0");

export const toISODate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** Fecha a mediodía local: evita saltos de día por horario de verano. */
export const fromISODate = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d, 12);
};

export const todayISO = () => toISODate(new Date());

export function addDays(iso: string, n: number) {
  const d = fromISODate(iso);
  d.setDate(d.getDate() + n);
  return toISODate(d);
}

export const daysBetween = (from: string, to: string) => Math.round((fromISODate(to).getTime() - fromISODate(from).getTime()) / 86_400_000);

/** Lunes = 0 … domingo = 6. */
export const weekdayIndex = (iso: string) => (fromISODate(iso).getDay() + 6) % 7;

/** Días de práctica entre hoy y el día anterior al examen (mismo cálculo que crear_plan). */
export function practiceDates(officialDate: string, days: DayKey[], from = todayISO()) {
  const keys = new Set(days);
  const out: string[] = [];
  for (let d = from; d < officialDate; d = addDays(d, 1)) if (keys.has(DIAS[weekdayIndex(d)].key)) out.push(d);
  return out;
}

const longFmt = new Intl.DateTimeFormat("es-MX", { weekday: "long", day: "numeric", month: "long" });
const shortFmt = new Intl.DateTimeFormat("es-MX", { weekday: "short", day: "numeric", month: "short" });
const fullFmt = new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "long", year: "numeric" });

export const formatLong = (iso: string) => longFmt.format(fromISODate(iso));
export const formatShort = (iso: string) => shortFmt.format(fromISODate(iso));
export const formatFull = (iso: string) => fullFmt.format(fromISODate(iso));

/** "16:00-18:00" → "4:00 p.m. – 6:00 p.m." */
export function formatWindow(win: string) {
  const fmt = (hhmm: string) => {
    const [h, m] = hhmm.split(":").map(Number);
    return new Intl.DateTimeFormat("es-MX", { hour: "numeric", minute: "2-digit" }).format(new Date(2000, 0, 1, h, m));
  };
  const [a, b] = win.split("-");
  return `${fmt(a)} – ${fmt(b)}`;
}

/* ─────────────────────────── Agenda derivada ─────────────────────────── */

/** Pendientes de hoy o atrasados, en orden: el primero es el que abre "Iniciar examen de hoy". */
export const dueSessions = (plan: StudentPlan, today = todayISO()) =>
  plan.sessions.filter((s) => s.status === "pendiente" && s.date <= today);

export const nextSession = (plan: StudentPlan, today = todayISO()) =>
  plan.sessions.find((s) => s.status === "pendiente" && s.date > today) ?? null;

export const completedSessions = (plan: StudentPlan) =>
  plan.sessions
    .filter((s): s is PlanSession & { exam: PlanExam } => s.exam !== null)
    .sort((a, b) => a.exam.completedAt.localeCompare(b.exam.completedAt));

/** El examen oficial ya llegó: el plan terminó (crear_plan lo cierra al crear uno nuevo). */
export const planEnded = (plan: StudentPlan, today = todayISO()) => plan.officialDate <= today;

/* ─────────────────────────── Rendimiento: regla de los últimos 3 ─────────────────────────── */

/** Mismos umbrales que nivel_plan() y el refuerzo en la migración. */
export const PLAN_ALTO = 85;
export const PLAN_BAJO = 65;
export const ULTIMOS = 3;

export type Estado = "excelente" | "riesgo" | "atencion";

export const ESTADOS: Record<Estado, { nombre: string; text: string; bg: string; fill: string }> = {
  excelente: { nombre: "Excelente", text: "text-secondary", bg: "bg-secondary/15", fill: "var(--secondary)" },
  riesgo: { nombre: "En riesgo", text: "text-gold", bg: "bg-gold/15", fill: "var(--gold)" },
  atencion: { nombre: "Atención necesaria", text: "text-destructive", bg: "bg-destructive/15", fill: "var(--destructive)" },
};

export const estadoDe = (pct: number): Estado => (pct >= PLAN_ALTO ? "excelente" : pct >= PLAN_BAJO ? "riesgo" : "atencion");

/** Promedio de los últimos 3 exámenes presentados (null si aún no hay ninguno). */
export function recentAverage(plan: StudentPlan) {
  const last = completedSessions(plan).slice(-ULTIMOS);
  if (last.length === 0) return null;
  const avg = Math.round(last.reduce((n, s) => n + s.exam.score, 0) / last.length);
  return { avg, estado: estadoDe(avg), exams: last.map((s) => s.exam) };
}

/** Dificultad que tocaría en modo automático (espejo de nivel_plan(); la base decide la real). */
export function nextAutoLevel(plan: StudentPlan): Nivel {
  if (plan.difficultyMode === "fixed" && plan.fixedLevel) return plan.fixedLevel;
  const last = completedSessions(plan).at(-1)?.exam;
  if (!last) return "media";
  const order: Nivel[] = ["facil", "media", "dificil"];
  const i = order.indexOf(last.level);
  const step = last.score >= PLAN_ALTO ? 1 : last.score < PLAN_BAJO ? -1 : 0;
  return order[Math.min(2, Math.max(0, i + step))];
}
