"use client";

import * as React from "react";

import { useMode } from "@/features/modes/components/mode-guard";

import type { StudentPlan } from "@/features/plan/lib/plan";

import { tutorKindOf, type TutorKind } from "../lib/tutor-plans";
import { SAMPLE_STUDENT, sampleExams, sampleGoals, type StudentGoal } from "../lib/tutor-sample";
import { getTutorExams, getTutorPanel, type TutorExam, type TutorPanel, type TutorStudent } from "../services/tutor-service";

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
  /** TEMPORAL (prototipo): ver el panel como si la cuenta estuviera pagada. No cambia nada en el servidor. */
  simulatedPaid: boolean;
  setSimulatedPaid: (on: boolean) => void;
  /** Exámenes de los estudiantes (con el switch: más el historial de ejemplo). */
  loadExams: (studentIds: string[]) => Promise<TutorExam[]>;
  /** Metas del estudiante (la del registro primero) y las agregadas en esta sesión (prototipo, no se guardan). */
  goalsOf: (student: TutorStudent) => StudentGoal[];
  addGoal: (studentId: string, goal: StudentGoal) => void;
  /** Planes programados desde el panel en esta sesión (prototipo, no se guardan). */
  extraPlans: (studentId: string) => StudentPlan[];
  addPlan: (studentId: string, plan: StudentPlan) => void;
};

const SIM_KEY = "em:tutor:simular-pagado";

/** Licencia ficticia para el switch de prototipo: plan vigente, un estudiante de ejemplo y lugar para todos. */
function simulatePaid(p: TutorPanel): TutorPanel {
  const now = Date.now();
  const students = [...p.students, SAMPLE_STUDENT];
  const seats = Math.max(students.length, 2);
  return {
    ...p,
    license: {
      id: "simulada",
      plan: seats <= 2 ? "family_2" : "family_5",
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
  const [simulatedPaid, setSim] = React.useState(false);

  React.useEffect(() => {
    try {
      setSim(localStorage.getItem(SIM_KEY) === "1");
    } catch {}
  }, []);

  const setSimulatedPaid = React.useCallback((on: boolean) => {
    setSim(on);
    try {
      localStorage.setItem(SIM_KEY, on ? "1" : "0");
    } catch {}
  }, []);

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
    const shown = panel && simulatedPaid ? simulatePaid(panel) : panel;
    const baseGoals = (s: TutorStudent): StudentGoal[] =>
      simulatedPaid
        ? sampleGoals(s)
        : s.career
          ? [{ careerId: `${s.id}-main`, career: s.career, universityId: (s.university ?? "").toLowerCase(), university: s.university ?? "", main: true }]
          : [];
    const goalsOf = (s: TutorStudent) => [...baseGoals(s), ...(goals[s.id] ?? [])];
    const loadExams = async (ids: string[]) => {
      const real = await getTutorExams(ids.filter((id) => id !== SAMPLE_STUDENT.id));
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
      simulatedPaid,
      setSimulatedPaid,
      loadExams,
      goalsOf,
      addGoal,
      extraPlans: (id: string) => plans[id] ?? [],
      addPlan,
    };
  }, [viewer.userType, panel, error, reload, patch, simulatedPaid, setSimulatedPaid, goals, plans, addGoal, addPlan]);

  return <TutorContext.Provider value={value}>{children}</TutorContext.Provider>;
}
