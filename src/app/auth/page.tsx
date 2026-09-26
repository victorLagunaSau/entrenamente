import type { Metadata } from "next";
import { Suspense } from "react";

import { LegacyAuthRedirect } from "@/features/auth/components/legacy-auth-redirect";

export const metadata: Metadata = { title: "Acceso", robots: { index: false } };

/** Solo redirige: el login vive en /login y el alta en /registro. */
export default function AuthPage() {
  return (
    <Suspense>
      <LegacyAuthRedirect />
    </Suspense>
  );
}
