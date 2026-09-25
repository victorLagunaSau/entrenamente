import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ExamMock } from "./exam-mock";

export function Hero() {
  return (
    <section className="relative isolate overflow-hidden pt-28 pb-20 sm:pt-36 lg:pt-44 lg:pb-32">
      <div aria-hidden className="bg-grid absolute inset-0 -z-10 [mask-image:radial-gradient(ellipse_at_top,black_30%,transparent_75%)]" />
      <div aria-hidden className="absolute top-0 left-1/2 -z-10 h-[520px] w-[900px] -translate-x-1/2 rounded-full bg-primary/25 blur-[120px]" />

      <div className="mx-auto grid max-w-7xl items-center gap-16 px-4 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:gap-12">
        <div className="flex flex-col items-center text-center lg:items-start lg:text-left">
          <span className="inline-flex items-center gap-2 rounded-full border border-energy/40 bg-energy/10 px-3 py-1 text-xs font-semibold text-energy">
            <Sparkles className="size-3.5" /> Entrenamiento bajo presión real
          </span>

          <h1 className="mt-6 text-4xl leading-[1.08] font-bold text-balance sm:text-5xl lg:text-6xl xl:text-[4.25rem]">
            ¿Sales mal en los exámenes{" "}
            <span className="text-brand-gradient">aunque te sabes las respuestas?</span>
          </h1>

          <h2 className="mt-6 max-w-xl font-sans text-lg font-normal tracking-normal text-muted-foreground text-pretty sm:text-xl">
            No es tu capacidad, es que te falta entrenar bajo la presión del{" "}
            <strong className="font-semibold text-cool">‘Estado Examen’</strong>. Practica con la plataforma dinámica
            diseñada para las universidades más importantes de México.
          </h2>

          <div className="mt-10 flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <Button asChild variant="energy" size="lg" className="h-14 px-8 text-base">
              <Link href="/auth?mode=register">
                Probar Gratis Ahora <ArrowRight className="size-5" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="h-14 border-cool/25 px-8 text-base">
              <a href="#planes">Ver Planes</a>
            </Button>
          </div>
        </div>

        <div className="px-4 sm:px-8 lg:px-0">
          <ExamMock />
        </div>
      </div>
    </section>
  );
}
