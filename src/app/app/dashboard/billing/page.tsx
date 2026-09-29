import type { Metadata } from "next";

import { BillingTab } from "@/features/dashboard/components/billing-tab";

export const metadata: Metadata = { title: "Suscripción" };

export default function DashboardBillingPage() {
  return <BillingTab />;
}
