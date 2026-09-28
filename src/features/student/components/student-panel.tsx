"use client";

import { Flame, NotebookPen, Trophy, User } from "lucide-react";

import { HomeTools } from "@/features/modes/components/home-tools";
import { ModeGuard } from "@/features/modes/components/mode-guard";
import { ModeSwitcher } from "@/features/modes/components/mode-switcher";
import { PanelShell } from "@/features/modes/components/panel-shell";

import { StudentWelcome } from "./student-welcome";

export function StudentPanel() {
  return (
    <ModeGuard mode="student">
      <PanelShell>
        <div className="flex flex-col gap-6">
          <ModeSwitcher />
          <StudentWelcome />
          <HomeTools
            tone="energy"
            tools={[
              { label: "Exámenes", description: "Simuladores de tu examen de admisión.", icon: NotebookPen, href: "/app/student/exam" },
              { label: "Rachas", description: "Tus días seguidos entrenando.", icon: Flame },
              { label: "Logros", description: "Medallas, XP y ranking.", icon: Trophy },
              { label: "Perfil", description: "Tus datos y metas.", icon: User },
            ]}
          />
        </div>
      </PanelShell>
    </ModeGuard>
  );
}
