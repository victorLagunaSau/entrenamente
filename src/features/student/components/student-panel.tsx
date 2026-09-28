"use client";

import * as React from "react";
import { CircleAlert, School } from "lucide-react";

import { MenuItem } from "@/features/modes/components/account-menu";
import { ModeGuard } from "@/features/modes/components/mode-guard";
import { ModeSwitcher } from "@/features/modes/components/mode-switcher";
import { PanelShell } from "@/features/modes/components/panel-shell";

import { getHomeCareers, type HomeCareer } from "../services/student-home-mock";
import { getStudentSummary, type StudentSummary } from "../services/student-service";
import { FreeExamModule, StreaksModule, StudyPlanModule } from "./home-modules";
import { StudentNav, StudentTopNav } from "./student-nav";
import { StudentWelcome } from "./student-welcome";

/** Home del estudiante: módulos apilados (Saludo → Plan → Examen libre → Rachas) y menú inferior. */
export function StudentPanel() {
  return (
    <ModeGuard mode="student">
      <PanelShell footer={<StudentNav />} topNav={<StudentTopNav />} accountExtra={<MenuItem icon={School} label="Agregar escuela" />}>
        <div className="flex flex-col gap-8">
          <ModeSwitcher />
          <StudentHome />
        </div>
      </PanelShell>
    </ModeGuard>
  );
}

function StudentHome() {
  const [summary, setSummary] = React.useState<StudentSummary | null | undefined>(undefined);
  const [careers, setCareers] = React.useState<HomeCareer[]>([]);
  const [failed, setFailed] = React.useState(false);

  React.useEffect(() => {
    getStudentSummary()
      .then((s) => {
        setSummary(s);
        if (s) setCareers(getHomeCareers(s.goal));
      })
      .catch(() => setFailed(true));
  }, []);

  if (failed) {
    return (
      <p
        role="alert"
        className="flex items-center gap-2 rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive"
      >
        <CircleAlert className="size-4 shrink-0" /> No pudimos cargar tu perfil. Recarga la página.
      </p>
    );
  }
  if (summary === undefined) {
    return <div className="h-40 animate-pulse rounded-2xl bg-card motion-reduce:animate-none" aria-label="Cargando tu perfil" />;
  }
  if (!summary) return null;

  // El fuego del saludo muestra la mejor racha activa entre todas las carreras.
  const streaks = careers.flatMap((c) => (c.streakDays !== null ? [c.streakDays] : []));
  const bestStreak = streaks.length > 0 ? Math.max(...streaks) : null;

  const updateCareer = (careerId: string, patch: (c: HomeCareer) => Partial<HomeCareer>) =>
    setCareers((prev) => prev.map((c) => (c.id === careerId ? { ...c, ...patch(c) } : c)));
  const activateStreak = (careerId: string) => updateCareer(careerId, () => ({ streakDays: 0, streakDoneToday: false }));
  // Simulado: resolver el micro examen suma el día y marca la palomita de hoy.
  const solveToday = (careerId: string) => updateCareer(careerId, (c) => ({ streakDays: (c.streakDays ?? 0) + 1, streakDoneToday: true }));

  return (
    <>
      <StudentWelcome summary={summary} streakDays={bestStreak} />
      {careers.length > 0 && (
        <>
          <StudyPlanModule careers={careers} />
          <FreeExamModule careers={careers} />
          <StreaksModule careers={careers} onActivate={activateStreak} onSolveToday={solveToday} />
        </>
      )}
    </>
  );
}
