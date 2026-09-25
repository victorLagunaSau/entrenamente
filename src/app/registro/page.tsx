import type { Metadata } from "next";
import { Suspense } from "react";

import { RegistrationPage } from "@/features/registro";

export const metadata: Metadata = { title: "Crear cuenta" };

export default function RegistroPage() {
  return (
    <main className="relative flex min-h-dvh flex-col justify-center overflow-x-clip px-4 pt-14 pb-8 sm:px-6 sm:py-12 lg:px-10">
      {/* Halos de marca: turquesa detrás del mensaje, azul detrás del formulario. */}
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute top-[8%] left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-secondary opacity-15 blur-3xl lg:left-[22%] lg:h-[28rem] lg:w-[28rem]" />
        <div className="absolute right-[8%] bottom-[5%] hidden h-[26rem] w-[26rem] rounded-full bg-primary opacity-20 blur-3xl lg:block" />
      </div>
      <Suspense>
        <RegistrationPage />
      </Suspense>
    </main>
  );
}
