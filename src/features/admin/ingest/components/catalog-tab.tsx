"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight, Eye, FilterX, Hash, Info, Loader2, Pencil, Search, SearchX, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MathText } from "@/features/exam/components/math-text";
import type { Dificultad } from "@/features/exam/types";
import { cn } from "@/lib/utils";

import { carrerasPorArea } from "@/features/escuelas/lib/catalogo";

import { DIFICULTADES, carreraNombre, findInstitucion } from "../lib/catalog";
import { missingFilters, searchMode } from "../lib/search";
import { useCatalogo } from "../lib/use-catalogo";
import { deleteQuestion, getMaterias, searchQuestions } from "../services/questions-service";
import type { Pregunta, QuestionFilters, SearchResult } from "../types";
import { DifficultyBadge, InstitucionDot, NativeSelect } from "./fields";

const EMPTY_FILTERS: QuestionFilters = { query: "", institucion: null, materia: null, carreras: null, dificultad: null };

/**
 * Buscador tipo Google: los filtros salen del catálogo fijo (no del banco) y la consulta
 * solo se ejecuta al presionar "Buscar". Sin ID, institución y materia son obligatorias
 * para no lanzar consultas costosas (ver lib/search).
 */
export function CatalogTab({
  version,
  onEdit,
  onPreview,
  onChanged,
}: {
  /** Cambia cuando otra pestaña guarda o importa: repite la última búsqueda. */
  version: number;
  onEdit: (q: Pregunta) => void;
  onPreview: (q: Pregunta) => void;
  onChanged: () => void;
}) {
  const [draft, setDraft] = React.useState<QuestionFilters>(EMPTY_FILTERS);
  // Última búsqueda enviada; null = aún no se ha buscado nada.
  const [submitted, setSubmitted] = React.useState<QuestionFilters | null>(null);
  const [page, setPage] = React.useState(1);
  const [result, setResult] = React.useState<SearchResult | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [toDelete, setToDelete] = React.useState<Pregunta | null>(null);
  const mode = searchMode(draft);
  const missing = missingFilters(draft);
  const byId = mode === "id";
  // Se lee en cada render: el importador puede haber registrado materias nuevas.
  const materias = getMaterias();
  const { catalogo } = useCatalogo();
  const inst = catalogo && draft.institucion ? findInstitucion(catalogo, draft.institucion) : null;
  // Valor del select "Carrera / Área": "area:<id>" (todas sus carreras) o "carrera:<id>".
  const [destinoKey, setDestinoKey] = React.useState("");
  const pickDestino = (key: string) => {
    setDestinoKey(key);
    const [kind, id] = key.split(":");
    const carreras = !key || !inst ? null : kind === "area" ? inst.carreras.filter((c) => c.areaId === id).map((c) => c.id) : [id];
    set({ carreras });
  };

  React.useEffect(() => {
    if (!submitted) return;
    let alive = true;
    setLoading(true);
    setError(null);
    searchQuestions(submitted, { page })
      .then((r) => {
        if (!alive) return;
        setResult(r);
        setLoading(false);
      })
      .catch((e: unknown) => {
        if (!alive) return;
        setError(e instanceof Error ? e.message : "No se pudo consultar el banco.");
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [submitted, page, version]);

  const set = (patch: Partial<QuestionFilters>) => setDraft((f) => ({ ...f, ...patch }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!mode) return;
    setSubmitted({ ...draft, query: draft.query.trim() });
    setPage(1);
  };

  const clear = () => {
    setDraft(EMPTY_FILTERS);
    setDestinoKey("");
    setSubmitted(null);
    setResult(null);
    setPage(1);
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Búsqueda y filtros */}
      <form onSubmit={submit} className="flex flex-col gap-4 rounded-2xl border bg-card p-4 sm:p-5" role="search">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              value={draft.query}
              onChange={(e) => set({ query: e.target.value })}
              placeholder="ID (UNAM-A1-MAT-007-V03) o tema dentro de los filtros"
              aria-label="Buscar preguntas por ID o tema"
              className="pl-9"
            />
          </div>
          <Button type="submit" size="lg" className="h-11 px-4 sm:px-6" disabled={!mode || loading}>
            {loading ? <Loader2 className="animate-spin" /> : <Search />}
            <span className="hidden sm:inline">Buscar</span>
          </Button>
        </div>

        <div className={cn("grid gap-3 transition-opacity sm:grid-cols-2 lg:grid-cols-4", byId && "opacity-50")}>
          <div className="flex flex-col gap-2">
            <Label htmlFor="filter-institucion">
              Institución <Required />
            </Label>
            <NativeSelect
              id="filter-institucion"
              aria-required={!byId}
              value={draft.institucion ?? ""}
              onChange={(e) => {
                set({ institucion: e.target.value || null, carreras: null });
                setDestinoKey("");
              }}
            >
              <option value="" disabled>
                Elige…
              </option>
              {catalogo?.map((i) => (
                <option key={i.id} value={i.clave}>
                  {i.clave}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="filter-materia">
              Materia <Required />
            </Label>
            <NativeSelect
              id="filter-materia"
              aria-required={!byId}
              value={draft.materia ?? ""}
              onChange={(e) => set({ materia: e.target.value || null })}
            >
              <option value="" disabled>
                Elige…
              </option>
              {materias.map((m) => (
                <option key={m.clave} value={m.clave}>
                  {m.nombre}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="filter-destino" className="flex items-baseline justify-between gap-2">
              Carrera / Área <Optional />
            </Label>
            <NativeSelect id="filter-destino" value={destinoKey} disabled={!inst} onChange={(e) => pickDestino(e.target.value)}>
              <option value="">{inst ? "Todas" : "Elige una institución"}</option>
              {inst &&
                carrerasPorArea(inst).map(({ area, carreras }) => (
                  <optgroup key={area?.id ?? "sin-area"} label={area ? `${area.codigo} · ${area.nombre}` : "Sin área"}>
                    {area && <option value={`area:${area.id}`}>Toda el área {area.codigo}</option>}
                    {carreras.map((c) => (
                      <option key={c.id} value={`carrera:${c.id}`}>
                        {c.nombre}
                      </option>
                    ))}
                  </optgroup>
                ))}
            </NativeSelect>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="filter-dificultad" className="flex items-baseline justify-between gap-2">
              Dificultad <Optional />
            </Label>
            <NativeSelect
              id="filter-dificultad"
              value={draft.dificultad ?? ""}
              onChange={(e) => set({ dificultad: (e.target.value || null) as Dificultad | null })}
            >
              <option value="">Todas</option>
              {DIFICULTADES.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.nombre}
                </option>
              ))}
            </NativeSelect>
          </div>
        </div>

        <p className="flex items-start gap-2 text-xs text-muted-foreground" aria-live="polite">
          {byId ? (
            <>
              <Hash className="mt-px size-3.5 shrink-0 text-secondary" /> Búsqueda directa por ID: se ignoran los filtros.
            </>
          ) : (
            <>
              <Info className="mt-px size-3.5 shrink-0" />
              {missing.length
                ? `Sin ID, elige ${missing.join(" y ")} para buscar.`
                : "Listo: carrera, dificultad y tema acotan aún más la búsqueda."}
            </>
          )}
        </p>
      </form>

      {/* Resultados */}
      {!submitted ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed p-10 text-center">
          <span className="grid size-12 place-items-center rounded-xl bg-primary/15 text-brand-light">
            <Search className="size-6" />
          </span>
          <p className="max-w-sm text-sm text-muted-foreground text-pretty">
            Busca por ID, o elige institución y materia (y opcionalmente carrera, dificultad o tema) y presiona{" "}
            <span className="font-semibold text-cool">Buscar</span>.
          </p>
        </div>
      ) : (
        <section className="flex flex-col gap-3" aria-busy={loading}>
          <div className="flex min-h-9 items-center justify-between gap-3">
            <p className="flex items-center gap-2 text-sm text-muted-foreground" aria-live="polite">
              {loading && <Loader2 className="size-4 animate-spin" />}
              {result && `${result.total} ${result.total === 1 ? "resultado" : "resultados"}`}
            </p>
            <Button variant="ghost" size="sm" onClick={clear}>
              <FilterX /> Limpiar búsqueda
            </Button>
          </div>

          {error ? (
            <p className="rounded-2xl border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : result && result.items.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed p-10 text-center text-sm text-muted-foreground">
              <SearchX className="size-6" />
              No hay preguntas con estos criterios.
            </div>
          ) : (
            <div className={cn("transition-opacity", loading && "opacity-60")}>
              <QuestionTable items={result?.items ?? []} onEdit={onEdit} onPreview={onPreview} onDelete={setToDelete} />
              <QuestionCards items={result?.items ?? []} onEdit={onEdit} onPreview={onPreview} onDelete={setToDelete} />
            </div>
          )}

          {result && result.pageCount > 1 && (
            <nav className="flex items-center justify-center gap-3" aria-label="Paginación">
              <Button variant="outline" size="icon" disabled={result.page <= 1} onClick={() => setPage(result.page - 1)} aria-label="Página anterior">
                <ChevronLeft />
              </Button>
              <span className="font-mono text-sm tabular-nums text-muted-foreground">
                {result.page} / {result.pageCount}
              </span>
              <Button
                variant="outline"
                size="icon"
                disabled={result.page >= result.pageCount}
                onClick={() => setPage(result.page + 1)}
                aria-label="Página siguiente"
              >
                <ChevronRight />
              </Button>
            </nav>
          )}
        </section>
      )}

      <DeleteDialog
        question={toDelete}
        onClose={() => setToDelete(null)}
        onDeleted={() => {
          setToDelete(null);
          onChanged();
        }}
      />
    </div>
  );
}

function Required() {
  return (
    <span className="text-destructive" aria-hidden>
      *
    </span>
  );
}

function Optional() {
  return <span className="text-xs font-normal text-muted-foreground">Opcional</span>;
}

const materiaNombre = (clave: string) => getMaterias().find((m) => m.clave === clave)?.nombre ?? clave;

type RowProps = {
  items: Pregunta[];
  onEdit: (q: Pregunta) => void;
  onPreview: (q: Pregunta) => void;
  onDelete: (q: Pregunta) => void;
};

function RowActions({ q, onEdit, onPreview, onDelete }: Omit<RowProps, "items"> & { q: Pregunta }) {
  return (
    <div className="flex items-center justify-end gap-1">
      <Button variant="ghost" size="icon" className="size-9" onClick={() => onEdit(q)} aria-label={`Editar ${q.id}`} title="Editar">
        <Pencil />
      </Button>
      <Button variant="ghost" size="icon" className="size-9" onClick={() => onPreview(q)} aria-label={`Vista previa de ${q.id}`} title="Vista previa">
        <Eye />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="size-9 hover:text-destructive"
        onClick={() => onDelete(q)}
        aria-label={`Eliminar ${q.id}`}
        title="Eliminar"
      >
        <Trash2 />
      </Button>
    </div>
  );
}

function QuestionTable({ items, ...actions }: RowProps) {
  const { catalogo } = useCatalogo();
  const nombre = (id: string) => (catalogo ? carreraNombre(catalogo, id) : id);
  return (
    <div className="hidden overflow-hidden rounded-2xl border bg-card lg:block">
      <table className="w-full text-sm">
        <thead className="bg-muted/60 text-left text-xs tracking-wider text-muted-foreground uppercase">
          <tr>
            <th className="px-4 py-3 font-semibold">ID</th>
            <th className="px-4 py-3 font-semibold">Institución / Materia</th>
            <th className="w-full px-4 py-3 font-semibold">Pregunta</th>
            <th className="px-4 py-3 font-semibold">Carreras</th>
            <th className="px-4 py-3 font-semibold">Dificultad</th>
            <th className="px-4 py-3 text-right font-semibold">
              <span className="sr-only">Acciones</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {items.map((q) => (
            <tr key={q.id} className="transition-colors hover:bg-accent/40">
              <td className="px-4 py-3 font-mono text-xs whitespace-nowrap text-gold">{q.id}</td>
              <td className="px-4 py-3 whitespace-nowrap">
                <span className="flex items-center gap-2 font-semibold">
                  <InstitucionDot clave={q.institucion} />
                  {q.institucion}
                </span>
                <span className="text-xs text-muted-foreground">{materiaNombre(q.materia)}</span>
              </td>
              <td className="min-w-64 px-4 py-3">
                <MathText text={q.pregunta} className="line-clamp-2 text-cool" />
              </td>
              <td className="px-4 py-3">
                <span className="block max-w-44 truncate text-xs text-muted-foreground" title={q.destinos.map(nombre).join("\n")}>
                  {q.destinos.length === 1 ? nombre(q.destinos[0]) : `${q.destinos.length} carreras`}
                </span>
              </td>
              <td className="px-4 py-3">
                <DifficultyBadge value={q.dificultad} />
              </td>
              <td className="px-2 py-2">
                <RowActions q={q} {...actions} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function QuestionCards({ items, ...actions }: RowProps) {
  return (
    <ul className="flex flex-col gap-3 lg:hidden">
      {items.map((q) => (
        <li key={q.id} className="flex flex-col gap-3 rounded-2xl border bg-card p-4">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="font-mono text-gold">{q.id}</span>
            <span className="ml-auto">
              <DifficultyBadge value={q.dificultad} />
            </span>
          </div>
          <MathText text={q.pregunta} className="line-clamp-3 text-sm text-cool" />
          <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
            <span className="flex min-w-0 items-center gap-1.5 truncate">
              <InstitucionDot clave={q.institucion} />
              {q.institucion} · {materiaNombre(q.materia)}
            </span>
            <RowActions q={q} {...actions} />
          </div>
        </li>
      ))}
    </ul>
  );
}

function DeleteDialog({ question, onClose, onDeleted }: { question: Pregunta | null; onClose: () => void; onDeleted: () => void }) {
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const confirm = async () => {
    if (!question) return;
    setBusy(true);
    setError(null);
    try {
      await deleteQuestion(question.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo eliminar.");
      setBusy(false);
      return;
    }
    setBusy(false);
    onDeleted();
  };

  return (
    <Dialog open={Boolean(question)} onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>¿Eliminar {question?.id}?</DialogTitle>
          <DialogDescription>
            Se quitará del banco y los estudiantes dejarán de verla en sus simulacros.
          </DialogDescription>
        </DialogHeader>
        {question && <MathText text={question.pregunta} className="line-clamp-3 block rounded-xl border bg-background/60 p-3 text-sm text-cool" />}
        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button className="bg-destructive hover:bg-destructive/90 hover:shadow-none" onClick={confirm} disabled={busy}>
            {busy ? <Loader2 className="animate-spin" /> : <Trash2 />} Eliminar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
