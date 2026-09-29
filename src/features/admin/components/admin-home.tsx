"use client";

import { FileJson, School, Sparkles, Users } from "lucide-react";

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
            description: "Búsqueda, captura, edición y carga por JSON.",
            icon: FileJson,
            href: "/admin/ingest",
          },
          {
            label: "Escuelas y Carreras",
            description: "Universidades, exámenes especiales, áreas y carreras.",
            icon: School,
            href: "/admin/escuelas",
          },
          {
            label: "Campaña Demo",
            description: "Textos, precio y exámenes gratis del Home Demo.",
            icon: Sparkles,
            href: "/admin/demo",
          },
        ]}
      />
    </div>
  );
}
