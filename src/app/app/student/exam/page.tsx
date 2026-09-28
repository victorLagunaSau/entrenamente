import type { Metadata } from "next";

import { ExamLibrePage } from "@/features/exam/components/libre/exam-libre";

export const metadata: Metadata = { title: "Examen libre" };

export default function ExamPage() {
  return <ExamLibrePage />;
}
