import type { Metadata } from "next";

import { ToeflExamPage } from "@/features/toefl/components/toefl-exam-flow";

export const metadata: Metadata = { title: "TOEFL ITP · Test" };

export default function ToeflExamRoute() {
  return <ToeflExamPage />;
}
