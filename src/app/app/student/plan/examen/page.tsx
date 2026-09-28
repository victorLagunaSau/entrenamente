import type { Metadata } from "next";

import { PlanExamPage } from "@/features/plan/components/plan-exam";

export const metadata: Metadata = { title: "Examen del plan" };

export default function PlanExamRoute() {
  return <PlanExamPage />;
}
