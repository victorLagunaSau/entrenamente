import { BookOpen, Calculator, FlaskConical, School, Sparkles, Users } from "lucide-react";

import { SectionHeading } from "./section-heading";

const AREAS = [
  { icon: BookOpen, title: "Lectura", body: "Comprender, interpretar y evaluar textos de la vida real, no solo localizar datos." },
  { icon: Calculator, title: "Matemáticas", body: "Plantear y resolver problemas cotidianos con razonamiento, no con fórmulas memorizadas." },
  { icon: FlaskConical, title: "Ciencias", body: "Explicar fenómenos, interpretar datos y evaluar evidencia como lo hace un científico." },
];

export function Pisa() {
  return (
    <section id="pisa" aria-labelledby="pisa-title" className="relative isolate border-y bg-surface-deep/60 py-20 sm:py-28">
      <div aria-hidden className="absolute top-0 left-1/2 -z-10 h-72 w-[60%] -translate-x-1/2 rounded-full bg-gold/10 blur-[120px]" />
      <div className="reveal mx-auto max-w-6xl px-4 sm:px-6">
        <div className="flex justify-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-gold/50 bg-gold/10 px-3 py-1 text-xs font-bold text-gold">
            <Sparkles className="size-3.5" /> Próximamente
          </span>
        </div>
        <SectionHeading
          id="pisa-title"
          eyebrow="Evaluación internacional PISA"
          title={
            <>
              El razonamiento que mide la OCDE, <span className="text-brand-gradient">entrenado desde la escuela</span>
            </>
          }
          subtitle="PISA no mide cuánto memorizas, sino cómo aplicas lo que sabes. Prepararemos a cada estudiante según su grado escolar, de primaria a preparatoria."
          className="mt-4"
        />

        <ul className="mt-12 grid grid-cols-1 gap-5 md:grid-cols-3">
          {AREAS.map(({ icon: Icon, title, body }) => (
            <li key={title} className="flex flex-col gap-4 rounded-3xl border bg-card/60 p-6 sm:p-7">
              <span className="grid size-12 place-items-center rounded-2xl bg-gold/15 text-gold">
                <Icon className="size-6" />
              </span>
              <h3 className="text-xl font-semibold">{title}</h3>
              <p className="text-muted-foreground">{body}</p>
            </li>
          ))}
        </ul>

        <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2">
          <a
            href="#contacto"
            className="flex items-center gap-4 rounded-2xl border border-dashed border-gold/40 bg-gold/5 p-5 transition-colors hover:border-gold hover:bg-gold/10"
          >
            <Users className="size-6 shrink-0 text-gold" />
            <span className="flex-1">
              <span className="block font-semibold">Para familias</span>
              <span className="block text-sm text-muted-foreground">Avísame cuando esté disponible para mis hijos.</span>
            </span>
            <span className="text-sm font-semibold text-gold">Avísame →</span>
          </a>
          <a
            href="#contacto"
            className="flex items-center gap-4 rounded-2xl border border-dashed border-gold/40 bg-gold/5 p-5 transition-colors hover:border-gold hover:bg-gold/10"
          >
            <School className="size-6 shrink-0 text-gold" />
            <span className="flex-1">
              <span className="block font-semibold">Para escuelas</span>
              <span className="block text-sm text-muted-foreground">Queremos probarlo con nuestros grupos.</span>
            </span>
            <span className="text-sm font-semibold text-gold">Escríbenos →</span>
          </a>
        </div>
      </div>
    </section>
  );
}
