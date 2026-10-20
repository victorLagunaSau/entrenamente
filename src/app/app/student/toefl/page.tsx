import type { Metadata } from "next";

import { ToeflHomePage } from "@/features/toefl/components/toefl-home";

export const metadata: Metadata = { title: "TOEFL ITP" };

export default function ToeflRoute() {
  return <ToeflHomePage />;
}
