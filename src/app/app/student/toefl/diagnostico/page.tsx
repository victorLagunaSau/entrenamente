import type { Metadata } from "next";

import { ToeflDiagnosticoPage } from "@/features/toefl/components/toefl-diagnostico";

export const metadata: Metadata = { title: "TOEFL ITP · Diagnostic Test" };

export default function ToeflDiagnosticoRoute() {
  return <ToeflDiagnosticoPage />;
}
