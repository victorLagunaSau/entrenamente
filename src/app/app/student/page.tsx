import type { Metadata } from "next";

import { StudentPanel } from "@/features/student/components/student-panel";

export const metadata: Metadata = { title: "Estudiante" };

export default function StudentPage() {
  return <StudentPanel />;
}
