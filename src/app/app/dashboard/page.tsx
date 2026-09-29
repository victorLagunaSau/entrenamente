import type { Metadata } from "next";

import { StudentsTab } from "@/features/dashboard/components/students-tab";

export const metadata: Metadata = { title: "Estudiantes" };

export default function DashboardStudentsPage() {
  return <StudentsTab />;
}
