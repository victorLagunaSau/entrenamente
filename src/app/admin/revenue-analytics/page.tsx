import type { Metadata } from "next";

import { RevenueWorkspace } from "@/features/admin/components/revenue/revenue-workspace";

export const metadata: Metadata = { title: "Ingresos y A/B" };

export default function AdminRevenuePage() {
  return <RevenueWorkspace />;
}
