"use client";

import * as React from "react";
import { AlertTriangle, ChevronDown, History, Loader2, Pencil, RefreshCw, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { Institucion } from "@/features/escuelas/types";
import { carrerasPorArea } from "@/features/escuelas/lib/catalogo";
import { cn } from "@/lib/utils";

import { DIFICULTADES, findCarrera } from "../lib/catalog";
import { useCatalogo } from "../lib/use-catalogo";
import { type ConteoBanco, type Inventario, getInventario, getMaterias } from "../services/questions-service";
import { type DosificacionInicial, DosificacionDialog } from "./dosificacion-dialog";
import { InstitucionDot } from "./fields";

const fmt = (n: number) => n.toLocaleString("es-MX");
const fecha = (iso: string) => new Date(iso).toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" });

/**
 * Inventario del banco: cuántas preguntas hay por escuela › área › carrera, por materia y dificultad,
 * qué carreras tienen dosificación y el historial de cargas masivas. Solo conteos (inventario_banco).
 */
export function InventoryTab({ version }: { version: number }) {
  const { catalogo, error: catalogoError } = useCatalogo();
  const [data, setData] = React.useState<Inventario | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  const load = React.useCallback(() => {
    setLoading(true);
    setError(null);
    getInventario()
      .then(setData)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "No se pudo leer el inventario."))
      .finally(() => setLoading(false));
  }, []);
  React.useEffect(() => load(), [load, version]);

  const err = error ?? catalogoError;
  if (err)
    return (
      <p className="flex flex-wrap items-center gap-2 rounded-2xl border border-destructive/50 bg-destructive/10 p-4 text-sm" role="alert">
        <XCircle className="size-4 text-destructive" /> {err}
        <Button type="button" variant="outline" size="sm" onClick={load}>
          <RefreshCw /> Reintentar
        </Button>
      </p>
    );
  if (!data || !catalogo)
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Contando preguntas…
      </p>
    );

  const byId = <T extends { id: string }>(xs: T[]) => new Map(xs.map((x) => [x.id, x]));
  const areas = byId(data.areas);
  const carreras = byId(data.carreras);
  const dosif = new Map(data.dosificacion.map((d) => [d.carrera_id, d]));
  const total = data.instituciones.reduce((s, i) => s + i.total, 0);
  const raices = data.instituciones.reduce((s, i) => s + i.raices, 0);
  const conPreguntas = catalogo.filter((i) => data.instituciones.some((x) => x.id === i.id));

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-sm text-muted-foreground sm:mr-auto">
          Preguntas por escuela, área y carrera. Una pregunta asignada a varias carreras cuenta una vez en su área y su escuela.
        </p>
        <Button type="button" variant="outline" size="sm" onClick={load} disabled={loading}>
          {loading ? <Loader2 className="animate-spin" /> : <RefreshCw />} Actualizar
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Preguntas en el banco" value={fmt(total)} />
        <Stat label="Raíces (sin variantes)" value={fmt(raices)} />
        <Stat label="Carreras con dosificación" value={fmt(data.dosificacion.length)} />
        <Stat label="Sin carrera asignada" value={fmt(data.sin_carrera)} tone={data.sin_carrera ? "text-gold" : undefined} />
      </div>

      {conPreguntas.length === 0 && <p className="text-sm text-muted-foreground">El banco aún no tiene preguntas.</p>}

      {conPreguntas.map((inst) => (
        <InstitucionCard
          key={inst.id}
          inst={inst}
          conteo={data.instituciones.find((x) => x.id === inst.id)!}
          areas={areas}
          carreras={carreras}
          dosif={dosif}
          onChanged={load}
        />
      ))}

      <Lotes lotes={data.lotes} catalogo={catalogo} />
    </div>
  );
}

function InstitucionCard({
  inst,
  conteo,
  areas,
  carreras,
  dosif,
  onChanged,
}: {
  inst: Institucion;
  conteo: ConteoBanco;
  areas: Map<string, ConteoBanco>;
  carreras: Map<string, ConteoBanco>;
  dosif: Map<string, Inventario["dosificacion"][number]>;
  onChanged: () => void;
}) {
  // Qué se está editando: un área completa o una sola carrera.
  const [editar, setEditar] = React.useState<{ titulo: string; carreras: string[]; inicial: DosificacionInicial | null; banco: Record<string, number> } | null>(
    null
  );
  return (
    <section className="flex flex-col gap-3 rounded-2xl border bg-card p-4 sm:p-5">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <InstitucionDot clave={inst.clave} />
        <h3 className="font-semibold">
          {inst.clave} <span className="font-normal text-muted-foreground">· {inst.nombre}</span>
        </h3>
        <span className="ml-auto font-mono text-sm tabular-nums">
          {fmt(conteo.total)} <span className="text-muted-foreground">preguntas · {fmt(conteo.raices)} raíces</span>
        </span>
      </header>
      <Desglose conteo={conteo} />

      <ul className="flex flex-col gap-2">
        {carrerasPorArea(inst).map(({ area, carreras: lista }) => {
          const c = area ? areas.get(area.id) : null;
          const conDatos = lista.filter((x) => carreras.has(x.id));
          if (!area && conDatos.length === 0) return null;
          const conDosif = lista.filter((x) => dosif.has(x.id)).length;
          const incompletas = c ? conDatos.filter((x) => carreras.get(x.id)!.total < c.total).length : 0;
          return (
            <li key={area?.id ?? "sin-area"}>
              <details className="group rounded-xl border bg-background/40">
                <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1 p-3 text-sm">
                  <span className="font-mono text-xs font-bold text-gold">{area?.codigo ?? "—"}</span>
                  <span className="min-w-0 flex-1 truncate font-medium">{area?.nombre ?? "Sin área"}</span>
                  {c || conDatos.length ? (
                    <span className="font-mono tabular-nums">
                      {fmt(c?.total ?? conDatos.reduce((s, x) => s + carreras.get(x.id)!.total, 0))}
                      {c && <span className="text-xs text-muted-foreground"> · {fmt(c.raices)} raíces</span>}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">Sin preguntas</span>
                  )}
                  <span className="text-xs text-muted-foreground">
                    {conDatos.length}/{lista.length} carreras · dosificación {conDosif}/{lista.length}
                  </span>
                  <ChevronDown className="size-4 text-muted-foreground transition-transform group-open:rotate-180" />
                </summary>
                <div className="flex flex-col gap-3 border-t p-3">
                  {c && <Desglose conteo={c} />}
                  {incompletas > 0 && (
                    <p className="flex items-center gap-1.5 text-xs text-gold">
                      <AlertTriangle className="size-3.5" /> {incompletas} {incompletas === 1 ? "carrera tiene" : "carreras tienen"} menos
                      preguntas que su área.
                    </p>
                  )}
                  <DosificacionArea
                    conteo={c ?? null}
                    dosis={lista.map((x) => dosif.get(x.id) ?? null)}
                    onEdit={(inicial) =>
                      setEditar({
                        titulo: `${area?.codigo ?? inst.clave} · ${area?.nombre ?? "Sin área"} (${lista.length} carreras)`,
                        carreras: lista.map((x) => x.id),
                        inicial,
                        banco: c?.por_materia ?? {},
                      })
                    }
                  />
                  <div className="flex items-center gap-3 border-b pb-1 text-xs text-muted-foreground">
                    <span className="flex-1">Carrera</span>
                    <span>Dosificación</span>
                    <span className="w-16 text-right">Preguntas</span>
                  </div>
                  <ul className="-mt-2 flex flex-col divide-y text-sm">
                    {lista.map((carrera) => {
                      const k = carreras.get(carrera.id);
                      const d = dosif.get(carrera.id);
                      return (
                        <li key={carrera.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
                          <span className={cn("min-w-0 flex-1", !k && "text-muted-foreground")}>{carrera.nombre}</span>
                          <button
                            type="button"
                            title={d ? [d.fuente, d.archivo, fecha(d.actualizado)].filter(Boolean).join(" · ") : "Agregar dosificación"}
                            onClick={() =>
                              setEditar({
                                titulo: carrera.nombre,
                                carreras: [carrera.id],
                                inicial: d ?? null,
                                banco: k?.por_materia ?? {},
                              })
                            }
                            className={cn(
                              "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium hover:ring-1 hover:ring-current",
                              !d ? "text-muted-foreground" : d.metodo === "oficial" ? "bg-secondary/15 text-secondary" : "bg-gold/15 text-gold"
                            )}
                          >
                            {d ? (d.metodo === "oficial" ? "Oficial" : "Estimada") : "Sin dosificación"} <Pencil className="size-3" />
                          </button>
                          <span className={cn("w-16 text-right font-mono tabular-nums", !k && "text-muted-foreground")}>
                            {k ? fmt(k.total) : 0}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </details>
            </li>
          );
        })}
      </ul>
      <DosificacionDialog
        open={Boolean(editar)}
        onOpenChange={(open) => !open && setEditar(null)}
        titulo={editar?.titulo ?? ""}
        carreras={editar?.carreras ?? []}
        inicial={editar?.inicial ?? null}
        banco={editar?.banco ?? {}}
        onSaved={onChanged}
      />
    </section>
  );
}

const mismaDosis = (a: Record<string, number>, b: Record<string, number>) =>
  Object.keys({ ...a, ...b }).every((k) => (a[k] ?? 0) === (b[k] ?? 0));

/** Dosificación del área: % por materia contra lo que hay en el banco; botón para corregirla. */
function DosificacionArea({
  conteo,
  dosis,
  onEdit,
}: {
  conteo: ConteoBanco | null;
  dosis: (Inventario["dosificacion"][number] | null)[];
  onEdit: (inicial: DosificacionInicial | null) => void;
}) {
  const nombre = (clave: string) => getMaterias().find((m) => m.clave === clave)?.nombre ?? clave;
  const con = dosis.filter((d): d is NonNullable<typeof d> => Boolean(d));
  const base = con[0] ?? null;
  const distintas = con.some((d) => !mismaDosis(d.por_materia, base!.por_materia));
  const claves = [...new Set([...Object.keys(base?.por_materia ?? {}), ...Object.keys(conteo?.por_materia ?? {})])].sort(
    (a, b) => (base?.por_materia[b] ?? 0) - (base?.por_materia[a] ?? 0)
  );
  return (
    <div className="flex flex-col gap-2 rounded-lg border bg-background/40 p-3 text-xs">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold">Dosificación</span>
        <span className="text-muted-foreground">
          {con.length === 0
            ? "Sin dosificación: los exámenes reparten en partes iguales."
            : `${con.length} de ${dosis.length} carreras${distintas ? " · no todas iguales (se muestra la primera)" : ""}${
                base?.total_reactivos_oficial ? ` · examen oficial de ${base.total_reactivos_oficial} reactivos` : ""
              }`}
        </span>
        <Button type="button" size="sm" variant="outline" className="ml-auto" onClick={() => onEdit(base)}>
          <Pencil /> {con.length ? "Corregir" : "Agregar"} para todas
        </Button>
      </div>
      {base && (
        <ul className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
          {claves.map((k) => {
            const p = base.por_materia[k];
            const n = conteo?.por_materia[k] ?? 0;
            return (
              <li key={k} className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate">{nombre(k)}</span>
                <span className={cn("font-mono tabular-nums", p === undefined && "text-gold")}>{p === undefined ? "falta" : `${p.toFixed(1)} %`}</span>
                <span className={cn("w-24 text-right text-muted-foreground", p && !n && "text-gold")}>{fmt(n)} en el banco</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/** Chips por materia y por dificultad. */
function Desglose({ conteo }: { conteo: ConteoBanco }) {
  const nombre = (clave: string) => getMaterias().find((m) => m.clave === clave)?.nombre ?? clave;
  const materias = Object.entries(conteo.por_materia).sort((a, b) => b[1] - a[1]);
  return (
    <div className="flex flex-col gap-2 text-xs">
      <div className="flex flex-wrap gap-1.5">
        {materias.map(([clave, n]) => (
          <span key={clave} className="rounded-md border bg-background/60 px-2 py-0.5">
            {nombre(clave)} <span className="font-mono font-semibold tabular-nums">{fmt(n)}</span>
          </span>
        ))}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {DIFICULTADES.map((d) => (
          <span key={d.value} className={cn("rounded-md px-2 py-0.5 font-medium", d.tone)}>
            {d.nombre} <span className="font-mono tabular-nums">{fmt(conteo.por_dificultad[d.value] ?? 0)}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

/** Últimas cargas masivas con el área que tocaron (deducida de sus carreras). */
function Lotes({ lotes, catalogo }: { lotes: Inventario["lotes"]; catalogo: Institucion[] }) {
  if (lotes.length === 0) return null;
  const destino = (ids: string[]) => {
    const areas = new Set<string>();
    for (const id of ids) {
      const hit = findCarrera(catalogo, id);
      if (hit) areas.add(`${hit.inst.clave}${hit.area ? ` ${hit.area.codigo}` : ""}`);
    }
    return [...areas].join(", ") || "—";
  };
  return (
    <section className="flex flex-col gap-3 rounded-2xl border bg-card p-4 sm:p-5">
      <h3 className="flex items-center gap-2 font-semibold">
        <History className="size-4 text-gold" /> Historial de cargas masivas
      </h3>
      <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <table className="w-full min-w-[40rem] text-sm">
          <thead className="text-left text-xs text-muted-foreground">
            <tr className="border-b">
              <th className="py-2 pr-3 font-medium">Fecha</th>
              <th className="py-2 pr-3 font-medium">Archivo</th>
              <th className="py-2 pr-3 font-medium">Destino</th>
              <th className="py-2 pr-3 text-right font-medium">En el archivo</th>
              <th className="py-2 pr-3 text-right font-medium">Nuevas</th>
              <th className="py-2 pr-3 text-right font-medium">Actualizadas</th>
              <th className="py-2 pr-3 text-right font-medium">Sin cambios</th>
              <th className="py-2 text-right font-medium">Omitidas</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {lotes.map((l) => (
              <tr key={l.id}>
                <td className="py-2 pr-3 whitespace-nowrap text-muted-foreground">{fecha(l.created_at)}</td>
                <td className="max-w-56 truncate py-2 pr-3" title={l.archivo}>
                  {l.archivo}
                </td>
                <td className="py-2 pr-3 whitespace-nowrap">
                  {destino(l.carreras)} <span className="text-xs text-muted-foreground">· {l.carreras.length} carreras</span>
                </td>
                <td className="py-2 pr-3 text-right font-mono tabular-nums">{fmt(l.total)}</td>
                <td className="py-2 pr-3 text-right font-mono text-secondary tabular-nums">{fmt(l.nuevas)}</td>
                <td className="py-2 pr-3 text-right font-mono tabular-nums">{fmt(l.actualizadas)}</td>
                <td className="py-2 pr-3 text-right font-mono text-muted-foreground tabular-nums">{fmt(l.sin_cambios)}</td>
                <td className={cn("py-2 text-right font-mono tabular-nums", l.omitidas ? "text-gold" : "text-muted-foreground")}>
                  {fmt(l.omitidas)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-xl border bg-card p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn("font-mono text-xl font-bold tabular-nums", tone)}>{value}</p>
    </div>
  );
}
