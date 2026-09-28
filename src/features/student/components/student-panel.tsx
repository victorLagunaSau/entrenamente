"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CircleAlert, School } from "lucide-react";

import { MenuItem } from "@/features/modes/components/account-menu";
import { ModeGuard } from "@/features/modes/components/mode-guard";
import { ModeSwitcher } from "@/features/modes/components/mode-switcher";
import { PanelShell } from "@/features/modes/components/panel-shell";

import { getFreeExamHistory, getRachaHistory } from "../services/exam-record-service";
import { getStudentCareers } from "../services/student-careers-service";
import { getHomeCareers, type HomeCareer } from "../services/student-home";
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
  const router = useRouter();
  const [summary, setSummary] = React.useState<StudentSummary | null | undefined>(undefined);
  const [careers, setCareers] = React.useState<HomeCareer[]>([]);
  const [failed, setFailed] = React.useState(false);

  React.useEffect(() => {
    getStudentSummary()
      .then(async (s) => {
        // Si el récord falla, el home se muestra igual con las fichas sin historial.
        const [list, history, rachas] = s
          ? await Promise.all([
              getStudentCareers(s.id),
              getFreeExamHistory(s.id).catch(() => new Map()),
              getRachaHistory(s.id).catch(() => new Map()),
            ])
          : [[], new Map(), new Map()];
        setSummary(s);
        setCareers(getHomeCareers(list, history, rachas));
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

  // Activar la racha es jugar la primera; el día cuenta al entregarla.
  const playRacha = (careerId: string) => router.push(`/app/student/racha?carrera=${encodeURIComponent(careerId)}`);

  return (
    <>
      <StudentWelcome summary={summary} streakDays={bestStreak} />
      {careers.length > 0 && (
        <>
          <StudyPlanModule careers={careers} />
          <FreeExamModule careers={careers} />
          <StreaksModule careers={careers} onActivate={playRacha} onSolveToday={playRacha} />
        </>
      )}
    </>
  );
}
