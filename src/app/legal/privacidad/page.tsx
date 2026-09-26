import type { Metadata } from "next";

import { LegalPage } from "@/features/legal/components/legal-page";
import { PRIVACY_SECTIONS } from "@/features/legal/content";

export const metadata: Metadata = { title: "Aviso de privacidad" };

export default function PrivacidadPage() {
  return <LegalPage title="Aviso de privacidad" sections={PRIVACY_SECTIONS} />;
}
