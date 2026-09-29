import type { Metadata } from "next";

import { TutorDashboard } from "@/features/dashboard/components/tutor-dashboard";
import { brandIcons } from "@/lib/brand";

// Versión maestro: favicon de la tabla con check.
export const metadata: Metadata = { title: "Panel", icons: brandIcons("maestro") };

/** Home Padre / Maestro: las pestañas Estudiantes, Estadísticas y Suscripción comparten este marco. */
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <TutorDashboard>{children}</TutorDashboard>;
}
