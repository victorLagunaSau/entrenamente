import type { Metadata } from "next";
import { Suspense } from "react";

import { AuthCard } from "@/features/auth/components/auth-card";
import { InviteRedirect } from "@/features/auth/components/invite-redirect";

export const metadata: Metadata = { title: "Acceso" };

export default function AuthPage() {
  return (
    <main className="flex min-h-dvh flex-col items-stretch justify-center px-4 py-8 sm:items-center">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 top-1/4 -z-10 mx-auto h-64 max-w-md rounded-full bg-brand-gradient opacity-15 blur-3xl"
      />
      <Suspense>
        <InviteRedirect />
        <AuthCard />
      </Suspense>
    </main>
  );
}
