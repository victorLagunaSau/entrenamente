import { FileCheck2 } from "lucide-react";

import { SectionHeading } from "./section-heading";

// Tarjetas tipográficas (sin logotipos oficiales, que son marcas registradas de cada institución).
const UNIVERSITIES = [
  { short: "UNAM", name: "Universidad Nacional Autónoma de México" },
  { short: "IPN", name: "Instituto Politécnico Nacional" },
  { short: "UAM", name: "Universidad Autónoma Metropolitana" },
  { short: "UVM", name: "Universidad del Valle de México" },
  { short: "TEC", name: "Tec de Monterrey", badge: "PAA" },
  { short: "UDG", name: "Universidad de Guadalajara" },
];

export function Universities() {
  return (
    <section aria-labelledby="universidades" className="relative border-y bg-surface-deep/60 py-20 sm:py-28">
      <div className="reveal mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading
          id="universidades"
          eyebrow="Cobertura de admisión"
          title="Prepárate para las universidades más importantes de México"
          subtitle={
            <span className="inline-flex items-center gap-2">
              <FileCheck2 className="size-5 shrink-0 text-secondary" />
              Exámenes de prueba basados en temarios y guías históricas oficiales.
            </span>
          }
        />

        <ul className="mt-14 grid grid-cols-2 gap-4 sm:gap-5 lg:grid-cols-3">
          {UNIVERSITIES.map((u) => (
            <li
              key={u.short}
              className="group relative overflow-hidden rounded-2xl border bg-card/60 p-5 transition-all duration-300 hover:-translate-y-1 hover:border-secondary/50 hover:shadow-glow-secondary sm:p-7"
            >
              <div
                aria-hidden
                className="absolute -top-10 -right-10 size-32 rounded-full bg-brand-gradient opacity-0 blur-2xl transition-opacity duration-300 group-hover:opacity-30"
              />
              <div className="flex items-start justify-between gap-2">
                <span className="font-display text-3xl font-bold tracking-tight text-brand-gradient sm:text-5xl">
                  {u.short}
                </span>
                {u.badge && (
                  <span className="rounded-md border border-energy/50 bg-energy/10 px-2 py-0.5 text-xs font-bold text-energy">
                    {u.badge}
                  </span>
                )}
              </div>
              <p className="mt-3 text-sm text-muted-foreground sm:text-base">{u.name}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
