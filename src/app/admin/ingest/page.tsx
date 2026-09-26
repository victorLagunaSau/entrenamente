import type { Metadata } from "next";

import { IngestWorkspace } from "@/features/admin/components/ingest-workspace";

export const metadata: Metadata = { title: "Preguntas" };

export default function IngestPage() {
  return <IngestWorkspace />;
}
