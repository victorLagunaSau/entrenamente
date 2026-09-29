import type { Metadata } from "next";
import { Suspense } from "react";

import { AnalyticsTab } from "@/features/dashboard/components/analytics-tab";

export const metadata: Metadata = { title: "Estadísticas" };

export default function DashboardAnalyticsPage() {
  return (
    <Suspense>
      <AnalyticsTab />
    </Suspense>
  );
}
