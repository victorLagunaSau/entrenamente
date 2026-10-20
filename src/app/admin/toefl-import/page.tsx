import type { Metadata } from "next";

import { ToeflImportWorkspace } from "@/features/toefl/components/toefl-import-workspace";

export const metadata: Metadata = { title: "TOEFL ITP" };

export default function ToeflImportPage() {
  return <ToeflImportWorkspace />;
}
