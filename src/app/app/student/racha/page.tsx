import type { Metadata } from "next";

import { RachaPage } from "@/features/exam/components/racha/racha-page";

export const metadata: Metadata = { title: "Racha" };

export default function RachaRoute() {
  return <RachaPage />;
}
