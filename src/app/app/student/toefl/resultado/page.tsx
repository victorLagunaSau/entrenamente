import type { Metadata } from "next";

import { ToeflResultPage } from "@/features/toefl/components/toefl-result";

export const metadata: Metadata = { title: "TOEFL ITP · Resultado" };

export default function ToeflResultRoute() {
  return <ToeflResultPage />;
}
