import type { Metadata } from "next";

import { TutorExamPage } from "@/features/dashboard/components/tutor-exam-page";

export const metadata: Metadata = { title: "Examen del estudiante" };

export default function TutorExamRoute() {
  return <TutorExamPage />;
}
