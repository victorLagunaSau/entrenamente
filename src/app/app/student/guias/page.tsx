import type { Metadata } from "next";

import { StudyGuidesPanel } from "@/features/student/components/study-guides";

export const metadata: Metadata = { title: "Guías de estudio" };

export default function StudyGuidesPage() {
  return <StudyGuidesPanel />;
}
