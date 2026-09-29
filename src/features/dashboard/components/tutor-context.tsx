"use client";

import * as React from "react";

import { useMode } from "@/features/modes/components/mode-guard";

import type { StudentPlan } from "@/features/plan/lib/plan";

import { tutorKindOf, type TutorKind } from "../lib/tutor-plans";
import { SAMPLE_IDS, SAMPLE_STUDENT, SAMPLE_STUDENT_2, sampleExams, sampleGoals, type StudentGoal } from "../lib/tutor-sample";
import { getTutorExams, getTutorPanel, type LicensePlan, type TutorExam, type TutorPanel, type TutorStudent } from "../services/tutor-service";

type Ctx = {
  kind: TutorKind;
  /** undefined = cargando. */
  panel: TutorPanel | undefined;
  error: boolean;
  reload: () => Promise<void>;
  /** Cambio optimista (p. ej. grupo de un estudiante) mientras responde el servidor. */
  patch: (fn: (p: TutorPanel) => TutorPanel) => void;
  /** Hubo una licencia y ya no está vigente: el panel se bloquea. */
  lapsed: boolean;
  /** TEMPORAL (prototipo): ver el panel como si tuviera ese plan. "free" = la cuenta tal cual. No toca el servidor. */
  simPlan: SimPlan;
  setSimPlan: (plan: SimPlan) => void;
  /** Hay un plan simulado (datos de ejemplo). */
  simulatedPaid: boolean;
  /** Exámenes de los estudiantes (con el switch: más el historial de ejemplo). */
  loadExams: (studentIds: string[]) => Promise<TutorExam[]>;
  /** Metas del estudiante (la del registro primero) y las agregadas en esta sesión (prototipo, no se guardan). */
  goalsOf: (student: TutorStudent) => StudentGoal[];
  addGoal: (studentId: string, goal: StudentGoal) => void;
  /** Planes programados desde el panel en esta sesión (prototipo, no se guardan). */
  extraPlans: (studentId: string) => StudentPlan[];
  addPlan: (studentId: string, plan: StudentPlan) => void;
};

export type SimPlan = "free" | "tutor" | "duo" | "familia";

export const SIM_PLANS: { id: SimPlan; label: string }[] = [
  { id: "free", label: "Free" },
  { id: "tutor", label: "Tutor" },
  { id: "duo", label: "Dúo" },
  { id: "familia", label: "Familia" },
];

const SIM_KEY = "em:tutor:simular-plan";

/** Cada plan simulado: sus cupos y los estudiantes de ejemplo que se suman al real (Familia deja un lugar libre). */
const SIM: Record<Exclude<SimPlan, "free">, { seats: number; plan: LicensePlan; extra: TutorStudent[] }> = {
  tutor: { seats: 1, plan: "individual", extra: [SAMPLE_STUDENT] },
  duo: { seats: 2, plan: "family_2", extra: [SAMPLE_STUDENT] },
  familia: { seats: 4, plan: "family_5", extra: [SAMPLE_STUDENT, SAMPLE_STUDENT_2] },
};

/** Licencia ficticia del prototipo: plan vigente con sus cupos y estudiantes de ejemplo. */
function simulatePlan(p: TutorPanel, sim: Exclude<SimPlan, "free">): TutorPanel {
  const now = Date.now();
  const { seats, plan, extra } = SIM[sim];
  const students = [...p.students, ...extra].slice(0, sim === "familia" ? 3 : seats);
  return {
    ...p,
    license: {
      id: "simulada",
      plan,
      seats,
      used: students.length,
      source: "stripe",
      active: true,
      startsAt: new Date(now).toISOString(),
      expiresAt: new Date(now + 30 * 86_400_000).toISOString(),
      autoRenew: true,
    },
    students: students.map((s) => ({ ...s, active: true, access: "tutor" })),
  };
}

const TutorContext = React.createContext<Ctx | null>(null);

export function useTutor() {
  const ctx = React.useContext(TutorContext);
  if (!ctx) throw new Error("useTutor debe usarse dentro de <TutorProvider>");
  return ctx;
}

/** Carga el panel una vez y lo comparte entre las pestañas Estudiantes, Estadísticas y Suscripción. */
export function TutorProvider({ children }: { children: React.ReactNode }) {
  const { viewer } = useMode();
  const [panel, setPanel] = React.useState<TutorPanel | undefined>(undefined);
  const [error, setError] = React.useState(false);
  const [simPlan, setSim] = React.useState<SimPlan>("free");

  React.useEffect(() => {
    try {
      const saved = localStorage.getItem(SIM_KEY) as SimPlan | null;
      if (saved && SIM_PLANS.some((p) => p.id === saved)) setSim(saved);
    } catch {}
  }, []);

  const setSimPlan = React.useCallback((plan: SimPlan) => {
    setSim(plan);
    try {
      localStorage.setItem(SIM_KEY, plan);
    } catch {}
  }, []);
  const simulatedPaid = simPlan !== "free";

  const reload = React.useCallback(async () => {
    try {
      setPanel(await getTutorPanel());
      setError(false);
    } catch {
      setError(true);
    }
  }, []);

  React.useEffect(() => {
    reload();
  }, [reload]);

  const [goals, setGoals] = React.useState<Record<string, StudentGoal[]>>({});
  const [plans, setPlans] = React.useState<Record<string, StudentPlan[]>>({});
  const addGoal = React.useCallback(
    (id: string, goal: StudentGoal) => setGoals((g) => ({ ...g, [id]: [...(g[id] ?? []), goal] })),
    []
  );
  const addPlan = React.useCallback(
    (id: string, plan: StudentPlan) => setPlans((g) => ({ ...g, [id]: [...(g[id] ?? []), plan] })),
    []
  );

  const patch = React.useCallback((fn: (p: TutorPanel) => TutorPanel) => setPanel((p) => (p ? fn(p) : p)), []);

  const value = React.useMemo<Ctx>(() => {
    const shown = panel && simPlan !== "free" ? simulatePlan(panel, simPlan) : panel;
    const baseGoals = (s: TutorStudent): StudentGoal[] =>
      simulatedPaid
        ? sampleGoals(s)
        : s.career
          ? [{ careerId: `${s.id}-main`, career: s.career, universityId: (s.university ?? "").toLowerCase(), university: s.university ?? "", main: true }]
          : [];
    const goalsOf = (s: TutorStudent) => [...baseGoals(s), ...(goals[s.id] ?? [])];
    const loadExams = async (ids: string[]) => {
      const real = await getTutorExams(ids.filter((id) => !SAMPLE_IDS.has(id)));
      if (!simulatedPaid || !shown) return real;
      const sample = shown.students.filter((s) => ids.includes(s.id)).flatMap((s) => sampleExams(s, sampleGoals(s)));
      return [...real, ...sample].sort((a, b) => a.completedAt.localeCompare(b.completedAt));
    };
    return {
      kind: tutorKindOf(viewer.userType),
      panel: shown,
      error,
      reload,
      patch,
      lapsed: !!shown?.license && !shown.license.active,
      simPlan,
      setSimPlan,
      simulatedPaid,
      loadExams,
      goalsOf,
      addGoal,
      extraPlans: (id: string) => plans[id] ?? [],
      addPlan,
    };
  }, [viewer.userType, panel, error, reload, patch, simPlan, setSimPlan, simulatedPaid, goals, plans, addGoal, addPlan]);

  return <TutorContext.Provider value={value}>{children}</TutorContext.Provider>;
}
