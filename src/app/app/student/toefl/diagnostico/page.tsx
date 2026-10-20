import type { Metadata } from "next";

import { ToeflDiagnosticoPage } from "@/features/toefl/components/toefl-exam-flow";

export const metadata: Metadata = { title: "TOEFL ITP · Diagnostic Test" };

export default function ToeflDiagnosticoRoute() {
  return <ToeflDiagnosticoPage />;
}
