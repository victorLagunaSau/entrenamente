import type { Metadata } from "next";

import { DemoCampaignWorkspace } from "@/features/admin/components/demo-campaign-workspace";

export const metadata: Metadata = { title: "Campaña de prueba gratuita" };

export default function AdminDemoPage() {
  return <DemoCampaignWorkspace />;
}
