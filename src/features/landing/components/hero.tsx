import { FileText, GraduationCap } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ExamMock } from "./exam-mock";
import { HeroExamStrip, HeroHeadline } from "./hero-headline";
import { HeroPrimaryCta, HeroTrialNote } from "./train-cta";

export function Hero() {
  return (
    <section className="relative isolate overflow-hidden pt-28 pb-20 sm:pt-36 lg:pt-44 lg:pb-32">
      <div aria-hidden className="bg-grid absolute inset-0 -z-10 [mask-image:radial-gradient(ellipse_at_top,black_30%,transparent_75%)]" />
      <div aria-hidden className="absolute top-0 left-1/2 -z-10 h-[520px] w-[900px] -translate-x-1/2 rounded-full bg-primary/25 blur-[120px]" />

      <div className="mx-auto grid max-w-7xl items-center gap-16 px-4 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:gap-12">
        <div className="flex flex-col items-center text-center lg:items-start lg:text-left">
          <span className="inline-flex items-center gap-2 rounded-full border border-secondary/40 bg-secondary/10 px-3 py-1 text-xs font-semibold text-secondary">
            <GraduationCap className="size-3.5" /> Simulador de exámenes de admisión y TOEFL
          </span>

          <HeroHeadline />

          <h2 className="mt-6 max-w-xl font-sans text-lg font-normal tracking-normal text-muted-foreground text-pretty sm:text-xl">
            Practica con exámenes de prueba con el <strong className="font-semibold text-cool">formato, el reloj y la presión</strong>{" "}
            del día real. Al terminar sabes qué fallaste, por qué y cómo resolverlo.
          </h2>

          <div className="mt-10 flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <HeroPrimaryCta />
            <Button asChild variant="outline" size="lg" className="h-14 border-cool/25 px-8 text-base">
              <a href="#guia-errores">
                <FileText className="size-5" /> Aprende de tus errores
              </a>
            </Button>
          </div>
          <HeroTrialNote />
          <HeroExamStrip />
        </div>

        <div className="px-4 sm:px-8 lg:px-0">
          <ExamMock />
        </div>
      </div>
    </section>
  );
}
