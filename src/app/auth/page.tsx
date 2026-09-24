import type { Metadata } from "next";

import { AuthCard } from "./auth-card";

export const metadata: Metadata = { title: "Acceso · ExaMente" };

export default function AuthPage() {
  return (
    <main className="flex min-h-[calc(100dvh-var(--devbar-h))] flex-col items-stretch justify-center px-4 py-8 sm:items-center">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 top-1/4 -z-10 mx-auto h-64 max-w-md rounded-full bg-primary/15 blur-3xl"
      />
      <AuthCard />
    </main>
  );
}
