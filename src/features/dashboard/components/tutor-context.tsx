"use client";

import * as React from "react";

import { useMode } from "@/features/modes/components/mode-guard";

import { tutorKindOf, type TutorKind } from "../lib/tutor-plans";
import { getTutorPanel, type TutorPanel } from "../services/tutor-service";

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
};

const SIM_KEY = "em:tutor:simular-pagado";

/** Licencia ficticia para el switch de prototipo: plan vigente con lugar para todos sus estudiantes. */
function simulatePaid(p: TutorPanel): TutorPanel {
  const now = Date.now();
  const seats = Math.max(p.students.length, 2);
  return {
    ...p,
    license: {
      id: "simulada",
      plan: seats <= 2 ? "family_2" : "family_5",
      seats,
      used: p.students.length,
      source: "stripe",
      active: true,
      startsAt: new Date(now).toISOString(),
      expiresAt: new Date(now + 30 * 86_400_000).toISOString(),
      autoRenew: true,
    },
    students: p.students.map((s) => ({ ...s, active: true, access: "tutor" })),
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

  const patch = React.useCallback((fn: (p: TutorPanel) => TutorPanel) => setPanel((p) => (p ? fn(p) : p)), []);

  const value = React.useMemo<Ctx>(() => {
    const shown = panel && simulatedPaid ? simulatePaid(panel) : panel;
    return {
      kind: tutorKindOf(viewer.userType),
      panel: shown,
      error,
      reload,
      patch,
      lapsed: !!shown?.license && !shown.license.active,
      simulatedPaid,
      setSimulatedPaid,
    };
  }, [viewer.userType, panel, error, reload, patch, simulatedPaid, setSimulatedPaid]);

  return <TutorContext.Provider value={value}>{children}</TutorContext.Provider>;
}
