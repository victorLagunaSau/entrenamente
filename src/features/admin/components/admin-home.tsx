"use client";

import { FileJson, Users } from "lucide-react";

import { HomeTools } from "@/features/modes/components/home-tools";
import { useMode } from "@/features/modes/components/mode-guard";
import { ModeSwitcher } from "@/features/modes/components/mode-switcher";

export function AdminHome() {
  const { viewer } = useMode();

  return (
    <div className="flex flex-col gap-6">
      <ModeSwitcher />
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold sm:text-3xl">¡Hola, {viewer.alias}!</h1>
        <p className="text-sm text-muted-foreground">Panel de administración de Entrena Mente.</p>
      </header>
      <HomeTools
        tone="gold"
        tools={[
          {
            label: "Gestión de Usuarios",
            description: "Usuarios registrados, licencias y cupones.",
            icon: Users,
            href: "/admin/users",
          },
          {
            label: "Banco de Preguntas",
            description: "Ingesta masiva de reactivos por JSON.",
            icon: FileJson,
            href: "/admin/ingest",
          },
        ]}
      />
    </div>
  );
}
