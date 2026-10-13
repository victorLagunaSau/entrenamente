"use client";

import * as React from "react";
import { BookOpenCheck, FileCheck2, GraduationCap, Languages, MessageSquarePlus, Sparkles } from "lucide-react";

import { cn } from "@/lib/utils";

import { InstitucionIcon, useIdentidades } from "@/features/identidad";

import { SectionHeading } from "./section-heading";

const TABS = [
  { id: "universidades", label: "Universidades", icon: GraduationCap },
  { id: "toefl", label: "TOEFL", icon: Languages },
  { id: "pisa", label: "PISA", icon: BookOpenCheck },
] as const;

type Tab = (typeof TABS)[number]["id"];

// Tarjetas tipográficas con la identidad de cada institución (Supabase); sin logotipos oficiales.
export function Universities() {
  const { identidades, ready } = useIdentidades();
  const [tab, setTab] = React.useState<Tab>("universidades");
  const universities = identidades.filter((i) => i.activo && i.tipo === "universidad");
  const especiales = identidades.filter((i) => i.activo && i.tipo === "examen_especial");

  return (
    <section aria-labelledby="universidades" className="relative border-y bg-surface-deep/60 py-20 sm:py-28">
      <div className="reveal mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading
          id="universidades"
          eyebrow="Cobertura de exámenes"
          title="Entrena para el examen que te abre la puerta"
          subtitle={
            <span className="inline-flex items-center gap-2">
              <FileCheck2 className="size-5 shrink-0 text-secondary" />
              Exámenes de práctica basados en temarios y guías históricas oficiales.
            </span>
          }
        />

        <div role="tablist" aria-label="Tipo de examen" className="scrollbar-none mx-auto mt-12 flex w-fit max-w-full gap-1 overflow-x-auto rounded-2xl border bg-card/60 p-1.5 sm:gap-2">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              role="tab"
              id={`tab-${id}`}
              aria-selected={tab === id}
              aria-controls={`panel-${id}`}
              onClick={() => setTab(id)}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors sm:gap-2 sm:px-5",
                tab === id ? "bg-brand-gradient text-white shadow-glow-secondary" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="size-4" /> {label}
            </button>
          ))}
        </div>

        <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="mt-10">
          {tab === "universidades" && (
            <>
              <p className="mx-auto max-w-2xl text-center text-muted-foreground">
                Exámenes de admisión de las universidades más importantes de México, con su propio diseño y tiempos.
              </p>
              <ul className="mt-8 grid grid-cols-2 gap-4 sm:gap-5 lg:grid-cols-3">
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
                {/* Solicitar una institución que aún no está en el catálogo. */}
                <li className="col-span-2 lg:col-span-3">
                  <a
                    href="#contacto"
                    className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-secondary/40 bg-secondary/5 p-6 text-center transition-colors hover:border-secondary hover:bg-secondary/10 sm:flex-row sm:text-left"
                  >
                    <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-secondary/15 text-secondary">
                      <MessageSquarePlus className="size-6" />
                    </span>
                    <span className="flex-1">
                      <span className="block font-display text-lg font-semibold">¿No está tu universidad o carrera?</span>
                      <span className="mt-1 block text-sm text-muted-foreground">
                        Solicítala y procesamos su temario oficial para que puedas entrenar con él.
                      </span>
                    </span>
                    <span className="text-sm font-semibold text-secondary">Solicitar →</span>
                  </a>
                </li>
              </ul>
            </>
          )}

          {tab === "toefl" && (
            <div className="mx-auto grid max-w-4xl grid-cols-1 items-center gap-8 rounded-3xl border bg-card/60 p-6 sm:p-10 md:grid-cols-[auto_1fr]">
              <span className="font-display text-5xl font-bold tracking-tight text-brand-gradient sm:text-6xl">
                {especiales.find((e) => e.id === "toefl")?.sigla ?? "TOEFL"}
              </span>
              <div>
                <h3 className="text-2xl font-semibold">Certificación de inglés</h3>
                <p className="mt-3 text-muted-foreground">
                  Preparación intensiva para el examen de suficiencia en inglés. Clave para titularte, para trámites
                  migratorios y para estudiar en el extranjero.
                </p>
              </div>
            </div>
          )}

          {tab === "pisa" && (
            <div className="mx-auto max-w-4xl rounded-3xl border bg-card/60 p-6 sm:p-10">
              <div className="flex flex-wrap items-center gap-3">
                <h3 className="text-2xl font-semibold">Evaluación internacional PISA</h3>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-gold/50 bg-gold/10 px-3 py-1 text-xs font-bold text-gold">
                  <Sparkles className="size-3.5" /> Próximamente
                </span>
              </div>
              <p className="mt-3 text-muted-foreground">
                Competencias de Lectura, Matemáticas y Ciencias por grado escolar. Entrena desde temprano el razonamiento
                lógico que mide la OCDE.
              </p>
              <a href="#contacto" className="mt-5 inline-block text-sm font-semibold text-secondary hover:underline">
                Avísame cuando esté disponible →
              </a>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
