import type { Metadata } from "next";

import { StudentPanel } from "@/features/student/components/student-panel";

export const metadata: Metadata = { title: "Estudiante · Prueba gratuita" };

export default function StudentDemoHomePage() {
  return <StudentPanel tier="demo" />;
}
