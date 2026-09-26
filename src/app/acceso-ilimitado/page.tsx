import type { Metadata } from "next";

import { UnlimitedAccessPage } from "@/features/acceso-ilimitado/components/unlimited-access-page";
import { AuthGuard } from "@/features/auth/components/auth-guard";

export const metadata: Metadata = { title: "Acceso ilimitado", robots: { index: false } };

export default function AccesoIlimitadoPage() {
  return (
    <AuthGuard>
      <UnlimitedAccessPage />
    </AuthGuard>
  );
}
