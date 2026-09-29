import type { Metadata } from "next";

import { ModeGuard } from "@/features/modes/components/mode-guard";
import { StudentHomeRedirect } from "@/features/student/components/tier-guard";

export const metadata: Metadata = { title: "Estudiante" };

/** Entrada única del estudiante: redirige a /home (Pro) o /home-demo según su suscripción. */
export default function StudentPage() {
  return (
    <ModeGuard mode="student">
      <StudentHomeRedirect />
    </ModeGuard>
  );
}
