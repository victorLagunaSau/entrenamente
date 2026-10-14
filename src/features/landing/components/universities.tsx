"use client";

import * as React from "react";
import {
  ArrowRight,
  BookOpenCheck,
  Clock,
  Gauge,
  MessageSquarePlus,
  Palette,
  Target,
} from "lucide-react";

import { useCatalogo } from "@/features/catalogo";
import {
  InstitucionIcon,
  useIdentidades,
  type Identidad,
} from "@/features/identidad";

import { CareersDialog } from "./careers-dialog";
import { SectionHeading } from "./section-heading";

/** Carreras activas por institución (catálogo compartido), para mostrar la cobertura real. */
function useCarrerasPorInstitucion() {
  const { data } = useCatalogo();
  return React.useMemo(() => {
    const c: Record<string, number> = {};
    for (const r of data?.carreras ?? [])
      c[r.institucionId] = (c[r.institucionId] ?? 0) + 1;
    return c;
  }, [data]);
}

const VENTAJAS = [
  {
    icon: Palette,
    title: "Con el diseño de tu universidad",
    body: "El examen toma los colores y el estilo de la institución: el día real nada te toma por sorpresa.",
  },
  {
    icon: Target,
    title: "Preguntas de tu carrera",
    body: "Cada reactivo está asignado a las carreras donde se evalúa.",
  },
  {
    icon: Gauge,
    title: "Fácil, Medio o Difícil",
    body: "Exámenes completos contra reloj en tres niveles.",
  },
  {
    icon: BookOpenCheck,
    title: "Guía de errores al terminar",
    body: "Diagnóstico y solución paso a paso de cada falla.",
  },
];

// Tarjetas tipográficas con la identidad de cada institución (Supabase); sin logotipos oficiales.
export function Universities() {
  const { identidades, ready } = useIdentidades();
  const carreras = useCarrerasPorInstitucion();
  // Activas primero; las de Próximamente se muestran con su etiqueta.
  const universities = identidades
    .filter((i) => (i.activo || i.proximamente) && i.tipo === "universidad")
    .sort((a, b) => Number(a.proximamente) - Number(b.proximamente));
  const total = universities
    .filter((u) => u.activo)
    .reduce((s, u) => s + (carreras[u.id] ?? 0), 0);
  const [abierta, setAbierta] = React.useState<Identidad | null>(null);

  return (
    <section
      id="universidades"
      aria-labelledby="universidades-title"
      className="relative isolate border-y bg-surface-deep/60 py-20 sm:py-28"
    >
      <div
        aria-hidden
        className="absolute top-0 left-1/2 -z-10 h-80 w-[70%] -translate-x-1/2 rounded-full bg-primary/15 blur-[120px]"
      />
      <div className="reveal mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading
          id="universidades-title"
          eyebrow="Admisión universitaria"
          title={
            <>
              Tu examen de admisión,{" "}
              <span className="text-brand-gradient">
                tal como lo vas a presentar
              </span>
            </>
          }
          subtitle={
            <>
              Exámenes de práctica basados en temarios y guías históricas
              oficiales de las universidades más importantes de México
              {total > 0 && (
                <>
                  :{" "}
                  <strong className="font-semibold text-cool">
                    {total} carreras
                  </strong>{" "}
                  y contando
                </>
              )}
              .
            </>
          }
        />

        <ul className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {VENTAJAS.map(({ icon: Icon, title, body }) => (
            <li
              key={title}
              className="flex gap-3 rounded-2xl border bg-card/40 p-4"
            >
              <Icon className="mt-0.5 size-5 shrink-0 text-secondary" />
              <div>
                <p className="text-sm font-semibold">{title}</p>
                <p className="mt-1 text-sm text-muted-foreground">{body}</p>
              </div>
            </li>
          ))}
        </ul>

        <ul className="mt-8 grid grid-cols-2 gap-4 sm:gap-5 lg:grid-cols-3">
          {universities.length === 0 &&
            !ready &&
            Array.from({ length: 6 }, (_, i) => (
              <li
                key={i}
                aria-hidden
                className="h-32 animate-pulse rounded-2xl border bg-card/40 motion-reduce:animate-none sm:h-40"
              />
            ))}
          {universities.map((u) => (
            <li key={u.id}>
              <button
                type="button"
                onClick={() => setAbierta(u)}
                aria-label={`Ver carreras de ${u.nombre}${u.proximamente ? " (próximamente)" : ""}`}
                className="group relative flex h-full w-full flex-col overflow-hidden rounded-2xl border bg-card/60 p-5 text-left transition-all duration-300 outline-none hover:-translate-y-1 hover:border-secondary/50 hover:shadow-glow-secondary focus-visible:ring-[3px] focus-visible:ring-ring/50 sm:p-7"
              >
                <div
                  aria-hidden
                  className="absolute -top-10 -right-10 size-32 rounded-full opacity-20 blur-2xl transition-opacity duration-300 group-hover:opacity-50"
                  style={{ background: `var(--uni-${u.id}, var(--primary))` }}
                />
                <div className="flex items-start justify-between gap-2">
                  <span className="flex items-center gap-3">
                    <span
                      className="grid size-10 shrink-0 place-items-center rounded-xl sm:size-12"
                      style={{ background: `var(--uni-${u.id}, var(--muted))` }}
                    >
                      <InstitucionIcon
                        id={u.id}
                        label=""
                        color={`var(--uni-${u.id}-fg, #ffffff)`}
                        className="size-5 sm:size-6"
                      />
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
                <p className="mt-3 text-sm text-muted-foreground sm:text-base">
                  {u.nombre}
                </p>
                <span className="mt-auto flex items-center justify-between gap-2 pt-4 text-xs font-semibold text-secondary">
                  {u.proximamente ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-gold/15 px-2 py-0.5 text-[11px] font-semibold text-gold">
                      <Clock className="size-3" aria-hidden /> Próximamente
                    </span>
                  ) : carreras[u.id] > 0 ? (
                    `${carreras[u.id]} ${carreras[u.id] === 1 ? "carrera" : "carreras"}`
                  ) : (
                    "Carreras"
                  )}
                  <span className="flex items-center gap-1 transition-transform group-hover:translate-x-0.5">
                    Ver <ArrowRight className="size-3.5" />
                  </span>
                </span>
              </button>
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
                <span className="block font-display text-lg font-semibold">
                  ¿No está tu universidad o carrera?
                </span>
                <span className="mt-1 block text-sm text-muted-foreground">
                  Solicítala y procesamos su temario oficial para que puedas
                  entrenar con él.
                </span>
              </span>
              <span className="text-sm font-semibold text-secondary">
                Solicitar →
              </span>
            </a>
          </li>
        </ul>
      </div>
      <CareersDialog uni={abierta} onClose={() => setAbierta(null)} />
    </section>
  );
}
