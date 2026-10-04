"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CircleAlert } from "lucide-react";

import { ModeGuard } from "@/features/modes/components/mode-guard";
import { ModeSwitcher } from "@/features/modes/components/mode-switcher";
import { PanelShell } from "@/features/modes/components/panel-shell";

import { PlanWizard } from "@/features/plan/components/plan-wizard";
import type { StudentPlan } from "@/features/plan/lib/plan";
import { getMyPlans } from "@/features/plan/services/plan-service";

import { STUDENT_HOMES, type StudentTier } from "../services/access-service";
import { getFreeExamHistory, getRachaHistory } from "../services/exam-record-service";
import { getStudentCareers, type StudentCareer } from "../services/student-careers-service";
import { getHomeCareers, type HomeCareer } from "../services/student-home";
import { getStudentSummary, type StudentSummary } from "../services/student-service";
import { FreeExamModule, StreaksModule, StudyPlanModule } from "./home-modules";
import { DemoHome } from "./demo/demo-home";
import { DEMO_NAV, PRO_NAV, StudentNav, StudentTopNav } from "./student-nav";
import { StudentWelcome } from "./student-welcome";
import { TierGuard } from "./tier-guard";
import { AddSchoolMenuItem } from "./add-school-menu-item";

/**
 * Home del estudiante con menú inferior. `pro` = suscripción activa (/app/student/home): Saludo → Plan →
 * Examen libre → Rachas. `demo` = prueba gratuita (/app/student/home-demo): ver DemoHome.
 */
export function StudentPanel({ tier }: { tier: StudentTier }) {
  const nav = tier === "demo" ? DEMO_NAV : PRO_NAV;
  return (
    <ModeGuard mode="student">
      <TierGuard tier={tier}>
        <PanelShell
          home={STUDENT_HOMES[tier]}
          footer={<StudentNav items={nav} />}
          topNav={<StudentTopNav items={nav} />}
          accountExtra={<AddSchoolMenuItem />}
        >
          <div className="flex flex-col gap-8">
            <ModeSwitcher />
            {tier === "demo" ? <DemoHome /> : <StudentHome />}
          </div>
        </PanelShell>
      </TierGuard>
    </ModeGuard>
  );
}

function StudentHome() {
  const router = useRouter();
  const [summary, setSummary] = React.useState<StudentSummary | null | undefined>(undefined);
  const [careers, setCareers] = React.useState<HomeCareer[]>([]);
  const [profileCareers, setProfileCareers] = React.useState<StudentCareer[]>([]);
  const [plans, setPlans] = React.useState<StudentPlan[] | null>(null);
  const [wizardOpen, setWizardOpen] = React.useState(false);
  const [failed, setFailed] = React.useState(false);

  // Sin las tablas del plan (migración pendiente) el módulo se muestra vacío.
  const loadPlans = React.useCallback(() => {
    getMyPlans()
      .then(setPlans)
      .catch(() => setPlans([]));
  }, []);

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
        setProfileCareers(list);
        setCareers(getHomeCareers(list, history, rachas));
      })
      .catch(() => setFailed(true));
    loadPlans();
  }, [loadPlans]);

  // Carreras del perfil sin plan activo: las únicas que ofrece el wizard.
  const planCareers = React.useMemo(
    () => profileCareers.filter((c) => !plans?.some((p) => p.careerId === c.id)),
    [profileCareers, plans]
  );

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
          <StudyPlanModule plans={plans} canCreate={planCareers.length > 0} onCreate={() => setWizardOpen(true)} />
          <PlanWizard open={wizardOpen} onOpenChange={setWizardOpen} careers={planCareers} onCreated={loadPlans} />
          <FreeExamModule careers={careers} />
          <StreaksModule careers={careers} onActivate={playRacha} onSolveToday={playRacha} />
        </>
      )}
    </>
  );
}
