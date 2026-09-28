import type { Metadata } from "next";

import { RachaResultPage } from "@/features/exam/components/racha/racha-page";

export const metadata: Metadata = { title: "Resultado de la racha" };

export default function RachaResultRoute() {
  return <RachaResultPage />;
}
