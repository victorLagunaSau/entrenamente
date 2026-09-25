import type { Metadata } from "next";
import { Suspense } from "react";

import { AuthCallback } from "@/features/auth/components/auth-callback";

export const metadata: Metadata = { title: "Entrando", robots: { index: false } };

export default function AuthCallbackPage() {
  return (
    <main className="flex min-h-dvh flex-col items-stretch justify-center px-4 py-8 sm:items-center">
      <Suspense>
        <AuthCallback />
      </Suspense>
    </main>
  );
}
