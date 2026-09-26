import type { Metadata } from "next";

import { AuthGuard } from "@/features/auth/components/auth-guard";
import { FreePlanPage } from "@/features/plan-gratuito/components/free-plan-page";

export const metadata: Metadata = { title: "Plan gratuito", robots: { index: false } };

export default function PlanGratuitoPage() {
  return (
    <AuthGuard>
      <FreePlanPage />
    </AuthGuard>
  );
}
