"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, Loader2, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { InstitucionIcon, type Identidad } from "@/features/identidad";
import { supabase } from "@/lib/supabase/client";

import { TrainButton, useLandingSession } from "./train-cta";

type Grupo = { area: string | null; carreras: string[] };

/** Sin acentos ni mayúsculas, para que "computacion" encuentre "Computación". */
const normal = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

/** Carreras activas de la institución, agrupadas por área (catálogo en Supabase). Se piden al abrir. */
function useCarreras(institucion: string | null) {
  const [grupos, setGrupos] = React.useState<Grupo[] | null>(null);

  React.useEffect(() => {
    if (!institucion) return;
    let vivo = true;
    setGrupos(null);
    Promise.all([
      supabase
        .from("areas")
        .select("id, nombre, orden")
        .eq("institucion_id", institucion)
        .eq("activo", true)
        .order("orden"),
      supabase
        .from("carreras")
        .select("nombre, area_id, orden")
        .eq("institucion_id", institucion)
        .eq("activo", true)
        .order("orden"),
    ]).then(([areas, carreras]) => {
      if (!vivo) return;
      const lista = carreras.data ?? [];
      const porArea: Grupo[] = (areas.data ?? []).map((a) => ({
        area: a.nombre,
        carreras: lista.filter((c) => c.area_id === a.id).map((c) => c.nombre),
      }));
      const conocidas = new Set((areas.data ?? []).map((a) => a.id));
      const sueltas = lista
        .filter((c) => !c.area_id || !conocidas.has(c.area_id))
        .map((c) => c.nombre);
      setGrupos(
        [
          ...porArea,
          ...(sueltas.length ? [{ area: null, carreras: sueltas }] : []),
        ].filter((g) => g.carreras.length),
      );
    });
    return () => {
      vivo = false;
    };
  }, [institucion]);

  return grupos;
}

/** Ventana con las carreras de una universidad: buscador y lista por área. */
export function CareersDialog({
  uni,
  onClose,
}: {
  uni: Identidad | null;
  onClose: () => void;
}) {
  const grupos = useCarreras(uni?.id ?? null);
  const [q, setQ] = React.useState("");
  const { loggedIn, homePath } = useLandingSession();

  React.useEffect(() => setQ(""), [uni?.id]);

  const filtro = normal(q.trim());
  const visibles = (grupos ?? [])
    .map((g) => ({
      ...g,
      carreras: filtro
        ? g.carreras.filter((c) => normal(c).includes(filtro))
        : g.carreras,
    }))
    .filter((g) => g.carreras.length);
  const total = grupos?.reduce((s, g) => s + g.carreras.length, 0) ?? 0;

  return (
    <Dialog open={!!uni} onOpenChange={(open) => !open && onClose()}>
      {/* Encabezado, buscador y botón fijos; solo la lista se desplaza (cómodo en el teléfono). */}
      <DialogContent className="h-[88dvh] gap-4 overflow-hidden sm:h-auto sm:max-h-[85dvh] sm:max-w-xl">
        {uni && (
          <>
            <DialogHeader>
              <div className="flex items-center gap-3">
                <span
                  className="grid size-12 shrink-0 place-items-center rounded-xl"
                  style={{ background: `var(--uni-${uni.id}, var(--muted))` }}
                >
                  <InstitucionIcon
                    id={uni.id}
                    label=""
                    color={`var(--uni-${uni.id}-fg, #ffffff)`}
                    className="size-6"
                  />
                </span>
                <div className="min-w-0">
                  <DialogTitle className="text-2xl">
                    Carreras{" "}
                    {/^(instituto|tecnol[oó]gico)/i.test(uni.nombre)
                      ? "del"
                      : "de la"}{" "}
                    {uni.sigla}
                  </DialogTitle>
                  <DialogDescription>
                    {uni.nombre}
                    {grupos &&
                      ` · ${total} ${total === 1 ? "carrera" : "carreras"}`}
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Busca tu carrera"
                aria-label="Buscar carrera"
                className="h-11 pl-9"
              />
            </div>

            <div className="-mx-2 min-h-40 flex-1 overflow-y-auto overscroll-contain px-2">
              {!grupos ? (
                <div className="grid h-40 place-items-center text-muted-foreground">
                  <Loader2 className="size-6 animate-spin" />
                </div>
              ) : visibles.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">
                  No encontramos «{q}». ¿No está tu carrera?{" "}
                  <a
                    href="#contacto"
                    onClick={onClose}
                    className="font-semibold text-secondary hover:underline"
                  >
                    Solicítala
                  </a>
                  .
                </p>
              ) : (
                <div className="flex flex-col gap-5">
                  {visibles.map((g) => (
                    <section key={g.area ?? "otras"}>
                      {(g.area || visibles.length > 1) && (
                        <h3 className="mb-2 flex items-baseline justify-between gap-3 text-xs font-semibold tracking-widest text-muted-foreground uppercase">
                          <span>{g.area ?? "Otras carreras"}</span>
                          <span className="font-mono">{g.carreras.length}</span>
                        </h3>
                      )}
                      <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                        {g.carreras.map((c) => (
                          <li
                            key={c}
                            className="rounded-lg border bg-background/40 px-3 py-1.5 text-sm text-cool sm:py-2"
                          >
                            {c}
                          </li>
                        ))}
                      </ul>
                    </section>
                  ))}
                </div>
              )}
            </div>

            {loggedIn ? (
              <TrainButton href={homePath} size="lg" className="h-12 w-full" />
            ) : (
              <Button
                asChild
                variant="energy"
                size="lg"
                className="h-12 w-full"
              >
                <Link href="/registro">
                  <span className="sm:hidden">Inicia prueba gratis</span>
                  <span className="hidden sm:inline">Entrena para tu carrera: inicia prueba gratis</span> <ArrowRight />
                </Link>
              </Button>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
