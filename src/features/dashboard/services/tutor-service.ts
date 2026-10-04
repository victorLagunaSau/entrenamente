/**
 * Home Padre / Maestro: todo pasa por funciones de Supabase (20260929000000_home_tutor.sql) que validan
 * que cada estudiante esté vinculado al tutor en sesión. El cliente nunca escribe tablas directo.
 */

import type { ExamRecord, Nivel } from "@/features/exam/lib/libre";
import type { PlanDraft, PlanSession, StudentPlan } from "@/features/plan/lib/plan";
import { toExamRecord } from "@/features/exam/services/libre-service";
import { inviteUrl } from "@/features/invitacion/lib/invite-link";
import { findCareer, findUniversity } from "@/features/registro/data/catalog";
import { supabase } from "@/lib/supabase/client";

export type LicensePlan = "individual" | "family_2" | "family_5" | "school" | "promo";

export type TutorLicense = {
  id: string;
  plan: LicensePlan;
  seats: number;
  used: number;
  source: "stripe" | "coupon" | "admin";
  /** Estado activo y sin vencer. */
  active: boolean;
  startsAt: string;
  expiresAt: string;
  autoRenew: boolean;
};

export type TutorGroup = { id: number; name: string };

export type TutorStudent = {
  id: string;
  alias: string;
  fullName: string;
  groupId: number | null;
  linkedAt: string;
  career: string | null;
  university: string | null;
  /** Ocupa un cupo vigente de una licencia de este tutor. */
  active: boolean;
  /** tutor = cupo del tutor; otra = otra licencia; prueba = periodo gratis vigente; inactivo = sin acceso. */
  access: StudentAccess;
  registeredAt: string | null;
  /** Periodo de prueba del estudiante (15 días desde su registro y exámenes gratis). */
  trial: { endsAt: string; granted: number; used: number } | null;
  /** Sus metas (la del registro primero). */
  goals: StudentGoal[];
};

/** Una meta del estudiante: carrera + universidad (student_goals). */
export type StudentGoal = { careerId: string; career: string; universityId: string; university: string; main: boolean };

export type StudentAccess = "tutor" | "otra" | "prueba" | "inactivo";

export type TutorPanel = { license: TutorLicense | null; groups: TutorGroup[]; students: TutorStudent[] };

export type ExamType = "plan" | "libre" | "racha";

export type MateriaSummary = { materia: string; total: number; correctas: number };

export type TutorExam = {
  id: number;
  studentId: string;
  folio: string;
  type: ExamType;
  /** "Prueba gratuita N" (solo exámenes hechos sin plan). */
  pruebaNumero: number | null;
  universityKey: string;
  careerName: string;
  level: "facil" | "media" | "dificil";
  totalQuestions: number;
  answeredQuestions: number;
  score: number;
  maxScore: number;
  timeSpentSeconds: number;
  completedAt: string;
  materias: MateriaSummary[];
};

type PanelRow = {
  licencia: {
    id: string;
    plan: LicensePlan;
    cupos: number;
    usados: number;
    origen: TutorLicense["source"];
    vigente: boolean;
    inicia: string;
    vence: string;
    renovacion_automatica: boolean;
  } | null;
  grupos: { id: number; nombre: string }[];
  estudiantes: {
    id: string;
    alias: string;
    nombre: string;
    grupo_id: number | null;
    vinculado: string;
    universidad_id: string | null;
    carrera_id: string | null;
    carrera: string | null;
    universidad: string | null;
    activo: boolean;
    // Desde 20260929010000_panel_tutor_prueba.sql (antes de correrla no vienen).
    acceso?: StudentAccess;
    registrado?: string;
    prueba?: { termina: string; otorgadas: number; usadas: number } | null;
    // Desde 20260929030000_tutor_pruebas_reales.sql.
    metas?: { carrera_id: string; universidad_id: string; carrera: string | null; universidad: string | null; inicial: boolean }[];
  }[];
};

export async function getTutorPanel(): Promise<TutorPanel> {
  const { data, error } = await supabase.rpc("panel_tutor");
  if (error) throw error;
  const row = data as PanelRow;
  const l = row.licencia;

  return {
    license: l && {
      id: l.id,
      plan: l.plan,
      seats: l.cupos,
      used: l.usados,
      source: l.origen,
      active: l.vigente,
      startsAt: l.inicia,
      expiresAt: l.vence,
      autoRenew: l.renovacion_automatica,
    },
    groups: row.grupos.map((g) => ({ id: g.id, name: g.nombre })),
    students: row.estudiantes.map((s) => ({
      id: s.id,
      alias: s.alias,
      fullName: s.nombre,
      groupId: s.grupo_id,
      linkedAt: s.vinculado,
      // Si la meta ya no está en el catálogo oficial, se toma del catálogo del registro.
      career: s.carrera ?? findCareer(s.universidad_id, s.carrera_id)?.name ?? null,
      university: s.universidad ?? findUniversity(s.universidad_id)?.short ?? null,
      active: s.activo,
      access: s.acceso ?? (s.activo ? "tutor" : "inactivo"),
      registeredAt: s.registrado ?? null,
      trial: s.prueba ? { endsAt: s.prueba.termina, granted: s.prueba.otorgadas, used: s.prueba.usadas } : null,
      goals: (s.metas ?? (s.carrera_id ? [{ carrera_id: s.carrera_id, universidad_id: s.universidad_id ?? "", carrera: s.carrera, universidad: s.universidad, inicial: true }] : [])).map((m) => ({
        careerId: m.carrera_id,
        career: m.carrera ?? findCareer(m.universidad_id, m.carrera_id)?.name ?? m.carrera_id,
        universityId: m.universidad_id,
        university: m.universidad ?? findUniversity(m.universidad_id)?.short ?? m.universidad_id.toUpperCase(),
        main: m.inicial,
      })),
    })),
  };
}

type ExamRow = {
  id: number;
  student_id: string;
  folio: string;
  exam_type: ExamType;
  prueba_numero?: number | null;
  university_key: string;
  career_name: string;
  level: TutorExam["level"];
  total_questions: number;
  answered_questions: number;
  score_achieved: number | string;
  max_score: number | string;
  time_spent_seconds: number;
  completed_at: string;
  resumen_por_materia: { materia: string; total: number | string; correctas: number | string }[];
};

/** Exámenes congelados de los estudiantes indicados (sin preguntas), del más antiguo al más reciente. */
export async function getTutorExams(studentIds: string[]): Promise<TutorExam[]> {
  if (studentIds.length === 0) return [];
  const { data, error } = await supabase.rpc("estadisticas_tutor", { p_estudiantes: studentIds });
  if (error) throw error;

  return (data as ExamRow[]).map((e) => ({
    id: e.id,
    studentId: e.student_id,
    folio: e.folio,
    type: e.exam_type,
    pruebaNumero: e.prueba_numero ?? null,
    universityKey: e.university_key,
    careerName: e.career_name,
    level: e.level,
    totalQuestions: e.total_questions,
    answeredQuestions: e.answered_questions,
    score: Number(e.score_achieved),
    maxScore: Number(e.max_score),
    timeSpentSeconds: e.time_spent_seconds,
    completedAt: e.completed_at,
    materias: (e.resumen_por_materia ?? []).map((m) => ({
      materia: m.materia,
      total: Number(m.total),
      correctas: Number(m.correctas),
    })),
  }));
}

/** Examen congelado completo (preguntas, fallas y soluciones) de un estudiante vinculado. */
export async function getTutorExamRecord(examId: number): Promise<ExamRecord> {
  const { data, error } = await supabase.rpc("examen_tutor", { p_examen: examId });
  if (error) throw error;
  return toExamRecord(data);
}

/** Cuántos estudiantes puede vincular el tutor: los cupos de su plan vigente; sin plan (demo), 1. */
export const studentLimit = (panel: TutorPanel) => (panel.license?.active ? panel.license.seats : 1);

/** Invitación de un solo estudiante que aún no se canjea. Sin meta, el estudiante elige escuela y carrera. */
export type PendingInvite = {
  code: string;
  url: string;
  label: string | null;
  universityId: string | null;
  careerId: string | null;
  createdAt: string;
  expiresAt: string;
};

type InviteRow = {
  code: string;
  label: string | null;
  university_id: string | null;
  career_id: string | null;
  created_at: string;
  expires_at: string;
};

export async function listInvites(): Promise<PendingInvite[]> {
  const { data, error } = await supabase.rpc("invitaciones_tutor");
  if (error) throw error;
  return ((data ?? []) as InviteRow[]).map((r) => ({
    code: r.code,
    url: inviteUrl(r.code),
    label: r.label,
    universityId: r.university_id,
    careerId: r.career_id,
    createdAt: r.created_at,
    expiresAt: r.expires_at,
  }));
}

export async function createInvite(input: {
  label?: string;
  universityId?: string | null;
  careerId?: string | null;
}): Promise<{ code: string; url: string }> {
  const { data, error } = await supabase.rpc("crear_invitacion_tutor", {
    p_university: input.universityId ?? null,
    p_career: input.careerId ?? null,
    p_label: input.label?.trim() || null,
  });
  if (error) throw error;
  const code = data as string;
  return { code, url: inviteUrl(code) };
}

/** Cancela una invitación pendiente y libera su lugar. */
export async function cancelInvite(code: string) {
  const { error } = await supabase.rpc("cancelar_invitacion_tutor", { p_code: code });
  if (error) throw error;
}

export async function createGroup(name: string): Promise<number> {
  const { data, error } = await supabase.rpc("crear_grupo_tutor", { p_nombre: name });
  if (error) throw error;
  return data as number;
}

export async function renameGroup(id: number, name: string) {
  const { error } = await supabase.rpc("renombrar_grupo_tutor", { p_grupo: id, p_nombre: name });
  if (error) throw error;
}

export async function deleteGroup(id: number) {
  const { error } = await supabase.rpc("borrar_grupo_tutor", { p_grupo: id });
  if (error) throw error;
}

export async function assignGroup(studentId: string, groupId: number | null) {
  const { error } = await supabase.rpc("asignar_grupo_tutor", { p_estudiante: studentId, p_grupo: groupId });
  if (error) throw error;
}

export async function activateSeat(studentId: string) {
  const { error } = await supabase.rpc("activar_lugar_tutor", { p_estudiante: studentId });
  if (error) throw error;
}

export async function releaseSeat(studentId: string) {
  const { error } = await supabase.rpc("liberar_lugar_tutor", { p_estudiante: studentId });
  if (error) throw error;
}

export async function unlinkStudent(studentId: string) {
  const { error } = await supabase.rpc("desvincular_estudiante_tutor", { p_estudiante: studentId });
  if (error) throw error;
}

/**
 * TEMPORAL (pruebas con grupo de enfoque, sin procesador de pagos): true = Plan Familiar de prueba real
 * (5 lugares, 30 días; sus estudiantes quedan con acceso ilimitado); false = vuelve a modo demo.
 */
export async function setTrialPlan(active: boolean) {
  const { error } = await supabase.rpc("plan_prueba_tutor", { p_activar: active });
  if (error) throw error;
}

/** Agrega otra carrera/escuela (del catálogo oficial) a las metas del estudiante. Requiere plan. */
export async function addStudentGoal(studentId: string, careerId: string) {
  const { error } = await supabase.rpc("agregar_meta_tutor", { p_estudiante: studentId, p_carrera: careerId });
  if (error) throw error;
}

type PlanRow = {
  id: number;
  career_id: string;
  university_key: string;
  career_name: string;
  official_exam_date: string;
  practice_days: StudentPlan["practiceDays"];
  exams_per_day: number;
  difficulty_mode: StudentPlan["difficultyMode"];
  fixed_difficulty_level: Nivel | null;
  preferred_time_window: string;
  created_at: string;
  plan_sessions: {
    id: number;
    scheduled_date: string;
    kind: PlanSession["kind"];
    status: PlanSession["status"];
    exam: { id: number; folio: string; level: Nivel; score_achieved: number | string; max_score: number | string; completed_at: string } | null;
  }[];
};

const pct = (score: number | string, max: number | string) => (Number(max) > 0 ? Math.round((Number(score) / Number(max)) * 100) : 0);

/** Planes de estudio activos del estudiante con su calendario (mismo formato que ve el alumno). */
export async function getStudentPlans(studentId: string): Promise<StudentPlan[]> {
  const { data, error } = await supabase.rpc("planes_tutor", { p_estudiante: studentId });
  if (error) throw error;
  return (data as PlanRow[]).map((p) => ({
    id: p.id,
    careerId: p.career_id,
    universityKey: p.university_key,
    careerName: p.career_name,
    officialDate: p.official_exam_date,
    practiceDays: p.practice_days,
    examsPerDay: p.exams_per_day,
    difficultyMode: p.difficulty_mode,
    fixedLevel: p.fixed_difficulty_level,
    timeWindow: p.preferred_time_window,
    createdAt: p.created_at,
    sessions: p.plan_sessions.map((s) => ({
      id: s.id,
      date: s.scheduled_date,
      kind: s.kind,
      status: s.status,
      exam: s.exam
        ? { id: s.exam.id, folio: s.exam.folio, level: s.exam.level, score: pct(s.exam.score_achieved, s.exam.max_score), completedAt: s.exam.completed_at }
        : null,
    })),
  }));
}

/** Programa el plan de estudio del estudiante (mismas reglas que cuando lo crea él). Requiere plan. */
export async function createStudentPlan(studentId: string, draft: PlanDraft): Promise<number> {
  const { data, error } = await supabase.rpc("crear_plan_tutor", {
    p_estudiante: studentId,
    p_carrera: draft.careerId,
    p_fecha_examen: draft.officialDate,
    p_dias: draft.practiceDays,
    p_por_dia: draft.examsPerDay,
    p_modo: draft.difficultyMode,
    p_nivel: draft.fixedLevel,
    p_horario: draft.timeWindow,
  });
  if (error) throw error;
  return Number(data);
}

/** Los mensajes de las funciones ya vienen en español para el usuario. */
export function errorMessage(e: unknown, fallback = "Algo salió mal. Intenta de nuevo.") {
  if (e && typeof e === "object" && "code" in e && e.code === "PGRST202")
    return "Falta correr en Supabase la migración 20260929030000_tutor_pruebas_reales.sql.";
  return e && typeof e === "object" && "message" in e && typeof e.message === "string" && e.message
    ? e.message
    : fallback;
}
