"use client";

import { FileCheck2 } from "lucide-react";

import { InstitucionIcon, useIdentidades } from "@/features/identidad";

import { SectionHeading } from "./section-heading";

// Tarjetas tipográficas con la identidad de cada institución (Supabase); sin logotipos oficiales.
export function Universities() {
  const { identidades, ready } = useIdentidades();
  const universities = identidades.filter((i) => i.activo && i.tipo === "universidad");

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
          {universities.length === 0 &&
            !ready &&
            Array.from({ length: 6 }, (_, i) => (
              <li key={i} aria-hidden className="h-32 animate-pulse rounded-2xl border bg-card/40 motion-reduce:animate-none sm:h-40" />
            ))}
          {universities.map((u) => (
            <li
              key={u.id}
              className="group relative overflow-hidden rounded-2xl border bg-card/60 p-5 transition-all duration-300 hover:-translate-y-1 hover:border-secondary/50 hover:shadow-glow-secondary sm:p-7"
            >
              <div
                aria-hidden
                className="absolute -top-10 -right-10 size-32 rounded-full bg-brand-gradient opacity-0 blur-2xl transition-opacity duration-300 group-hover:opacity-30"
              />
              <div className="flex items-start justify-between gap-2">
                <span className="flex items-center gap-3">
                  <span
                    className="grid size-10 shrink-0 place-items-center rounded-xl sm:size-12"
                    style={{ background: `var(--uni-${u.id}, var(--muted))` }}
                  >
                    <InstitucionIcon id={u.id} label="" color={`var(--uni-${u.id}-fg, #ffffff)`} className="size-5 sm:size-6" />
                  </span>
                  <span className="font-display text-3xl font-bold tracking-tight text-brand-gradient sm:text-5xl">
                    {u.sigla}
                  </span>
                </span>
                {u.examen && (
                  <span className="rounded-md border border-energy/50 bg-energy/10 px-2 py-0.5 text-xs font-bold text-energy">
                    {u.examen}
                  </span>
                )}
              </div>
              <p className="mt-3 text-sm text-muted-foreground sm:text-base">{u.nombre}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
