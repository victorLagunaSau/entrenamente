import type { Metadata } from "next";

import { DashboardPanel } from "@/features/dashboard/components/dashboard-panel";
import { brandIcons } from "@/lib/brand";

// Versión maestro: favicon de la tabla con check.
export const metadata: Metadata = { title: "Dashboard", icons: brandIcons("maestro") };

export default function DashboardPage() {
  return <DashboardPanel />;
}
