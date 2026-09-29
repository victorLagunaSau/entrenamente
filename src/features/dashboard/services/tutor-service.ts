/**
 * Home Padre / Maestro: todo pasa por funciones de Supabase (20260929000000_home_tutor.sql) que validan
 * que cada estudiante esté vinculado al tutor en sesión. El cliente nunca escribe tablas directo.
 */

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
};

export type StudentAccess = "tutor" | "otra" | "prueba" | "inactivo";

export type TutorPanel = { license: TutorLicense | null; groups: TutorGroup[]; students: TutorStudent[] };

export type ExamType = "plan" | "libre" | "racha";

export type MateriaSummary = { materia: string; total: number; correctas: number };

export type TutorExam = {
  id: number;
  studentId: string;
  folio: string;
  type: ExamType;
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
    })),
  };
}

type ExamRow = {
  id: number;
  student_id: string;
  folio: string;
  exam_type: ExamType;
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

/** Enlace de invitación de la licencia vigente. `renew` invalida el anterior y genera otro. */
export async function getInviteLink(renew = false): Promise<{ code: string; url: string }> {
  const { data, error } = await supabase.rpc("invitacion_tutor", { p_nuevo: renew });
  if (error) throw error;
  const code = data as string;
  return { code, url: `${window.location.origin}/auth?invite=${code}` };
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

/** Los mensajes de las funciones ya vienen en español para el usuario. */
export function errorMessage(e: unknown, fallback = "Algo salió mal. Intenta de nuevo.") {
  return e && typeof e === "object" && "message" in e && typeof e.message === "string" && e.message
    ? e.message
    : fallback;
}
