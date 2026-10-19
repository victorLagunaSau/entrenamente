import { supabase } from "@/lib/supabase/client";

/** Lo que cuenta para la guía de uso del estudiante: plan activo, examen libre y racha (alguna vez). */
export type AvanceGuia = { plan: boolean; libre: boolean; racha: boolean };

const cuenta = (tabla: "student_plans" | "exam_history") => supabase.from(tabla).select("id", { count: "exact", head: true });

export async function getAvanceGuia(studentId: string): Promise<AvanceGuia> {
  const [plan, libre, racha] = await Promise.all([
    cuenta("student_plans").eq("student_id", studentId).eq("status", "active"),
    cuenta("exam_history").eq("student_id", studentId).eq("exam_type", "libre"),
    cuenta("exam_history").eq("student_id", studentId).eq("exam_type", "racha"),
  ]);
  const error = plan.error ?? libre.error ?? racha.error;
  if (error) throw error;
  return { plan: (plan.count ?? 0) > 0, libre: (libre.count ?? 0) > 0, racha: (racha.count ?? 0) > 0 };
}
