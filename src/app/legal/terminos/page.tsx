import type { Metadata } from "next";

import { LegalPage } from "@/features/legal/components/legal-page";
import { TERMS_SECTIONS } from "@/features/legal/content";

export const metadata: Metadata = { title: "Términos y condiciones" };

export default function TerminosPage() {
  return <LegalPage title="Términos y condiciones" sections={TERMS_SECTIONS} />;
}
