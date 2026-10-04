import type { Metadata } from "next";

import { MyCareersPanel } from "@/features/student/components/my-careers";

export const metadata: Metadata = { title: "Mis carreras" };

export default function MyCareersPage() {
  return <MyCareersPanel />;
}
