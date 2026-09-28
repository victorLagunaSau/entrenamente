import type { Metadata } from "next";

import { ExamResultPage } from "@/features/exam/components/libre/exam-libre";

export const metadata: Metadata = { title: "Resultado del examen" };

export default function ExamResultRoute() {
  return <ExamResultPage />;
}
