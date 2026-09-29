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
};

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

  const value = React.useMemo<Ctx>(
    () => ({
      kind: tutorKindOf(viewer.userType),
      panel,
      error,
      reload,
      patch,
      lapsed: !!panel?.license && !panel.license.active,
    }),
    [viewer.userType, panel, error, reload, patch]
  );

  return <TutorContext.Provider value={value}>{children}</TutorContext.Provider>;
}
