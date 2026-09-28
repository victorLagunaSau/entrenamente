import type { Metadata } from "next";

import { PlanPanel } from "@/features/plan/components/plan-page";

export const metadata: Metadata = { title: "Mi plan" };

export default function PlanPage() {
  return <PlanPanel />;
}
