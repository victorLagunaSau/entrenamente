"use client";

import { CreditCard, Settings, UserPlus, Users } from "lucide-react";

import { HomeTools } from "@/features/modes/components/home-tools";
import { ModeGuard, useMode } from "@/features/modes/components/mode-guard";
import { ModeSwitcher } from "@/features/modes/components/mode-switcher";
import { PanelShell } from "@/features/modes/components/panel-shell";

/** Home de padres/tutores: gestionan a sus estudiantes; no ven ni hacen cuestionarios. */
export function DashboardPanel() {
  return (
    <ModeGuard mode="parent">
      <PanelShell>
        <ParentHome />
      </PanelShell>
    </ModeGuard>
  );
}

function ParentHome() {
  const { viewer } = useMode();

  return (
    <div className="flex flex-col gap-6">
      <ModeSwitcher />
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold sm:text-3xl">¡Hola, {viewer.alias}!</h1>
        <p className="text-sm text-muted-foreground">Gestiona a tus estudiantes y sus licencias.</p>
      </header>
      <HomeTools
        tools={[
          { label: "Mis estudiantes", description: "Quiénes están ligados a tu cuenta.", icon: Users },
          { label: "Invitar estudiante", description: "Envía un código para ligar a un estudiante.", icon: UserPlus },
          { label: "Licencias", description: "Tu plan y los lugares asignados.", icon: CreditCard },
          { label: "Mi cuenta", description: "Tus datos y preferencias.", icon: Settings },
        ]}
      />
    </div>
  );
}
