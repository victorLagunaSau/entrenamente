"use client";

import * as React from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Download,
  Eye,
  FileJson,
  FileUp,
  Hammer,
  Loader2,
  RefreshCw,
  Trash2,
  Upload,
  Wrench,
  XCircle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { MathText } from "@/features/exam/components/math-text";
import { cn } from "@/lib/utils";

import { carrerasSugeridas, findInstitucion } from "../lib/catalog";
import { useCatalogo } from "../lib/use-catalogo";
import {
  type Guia,
  type ImportRow,
  type Issue,
  fieldLabel,
  guiaTotals,
  hasErrors,
  parseJson,
  parseLote,
  reviewGuia,
  reviewItems,
} from "../lib/validation";
import {
  type Existente,
  type ImportPlan,
  getExistentes,
  getMaterias,
  importChunk,
  loadMaterias,
  planImport,
  registrarLote,
} from "../services/questions-service";
import type { Pregunta } from "../types";
import { CarrerasSelector } from "./carreras-selector";
import { DifficultyBadge, Textarea } from "./fields";

const MAX_BYTES = 10 * 1024 * 1024;
/** Reactivos por llamada a la base: cada bloque es una transacción corta. */
const CHUNK = 50;
const PAGE = 60;

type Filter = "error" | "aviso" | "fix" | "ok" | "all";
type Status =
  | { kind: "idle" }
  | { kind: "importing"; done: number; total: number }
  | { kind: "done"; result: ImportPlan; omitidas: number }
  | { kind: "error"; message: string; result: ImportPlan };

const rowLevel = (r: ImportRow): "error" | "aviso" | "ok" => (hasErrors(r.issues) ? "error" : r.issues.length ? "aviso" : "ok");

/** Agrupa mensajes parecidos ("Falta el diagnóstico…" ×12) para ver los errores del generador de un vistazo. */
const issueKind = (i: Issue) =>
  `${i.level}|${i.field.split(".")[0]}|${i.message
    .replace(/«[^»]*»/g, "«…»")
    .replace(/\b[A-Z0-9]+-[A-Z0-9]+-[A-Z]+-\d+(-V\d+)?\b/g, "ID")
    .replace(/\d+/g, "n")}`;

export function BulkImportTab({
  onImported,
  onPreview,
}: {
  onImported: () => void;
  onPreview: (q: Pregunta) => void;
}) {
  const [text, setText] = React.useState("");
  const [fileName, setFileName] = React.useState<string | null>(null);
  const [fileError, setFileError] = React.useState<string | null>(null);
  const [dragging, setDragging] = React.useState(false);
  // Elementos del lote ya leídos; se reparan o quitan uno a uno. `uids` los identifica aunque cambie su posición.
  const [items, setItems] = React.useState<unknown[] | null>(null);
  const [uids, setUids] = React.useState<number[]>([]);
  // Bloque "guia" del lote ({ guia, reactivos }); sus totales se recalculan al quitar o reparar.
  const [guia, setGuia] = React.useState<Guia | null>(null);
  const [guiaIssues, setGuiaIssues] = React.useState<string[]>([]);
  const [syntax, setSyntax] = React.useState<{ syntaxError: string; line?: number } | null>(null);
  const [edited, setEdited] = React.useState<Set<number>>(new Set());
  const [removed, setRemoved] = React.useState(0);
  const [validating, setValidating] = React.useState(false);
  // Paso 1: institución y carreras a las que se asigna todo el lote (muchos a muchos).
  const { catalogo, error: catalogoError, reload: reloadCatalogo } = useCatalogo();
  const [institucion, setInstitucion] = React.useState<string | null>(null);
  const [destinos, setDestinos] = React.useState<string[]>([]);
  const [status, setStatus] = React.useState<Status>({ kind: "idle" });
  const [filter, setFilter] = React.useState<Filter>("all");
  const [limit, setLimit] = React.useState(PAGE);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const validate = (value: string) => {
    setValidating(true);
    // Deja pintar "Validando…" antes del trabajo pesado (KaTeX revisa cada fórmula).
    setTimeout(() => {
      const result = parseLote(value);
      setItems(result.ok ? result.items : null);
      setGuia(result.ok ? result.guia : null);
      setGuiaIssues(result.ok && result.guia ? reviewGuia(result.guia, result.items) : []);
      setUids(result.ok ? result.items.map((_, i) => i) : []);
      setSyntax(result.ok ? null : result);
      setEdited(new Set());
      setRemoved(0);
      setFilter("all");
      setLimit(PAGE);
      setStatus({ kind: "idle" });
      setValidating(false);
    }, 30);
  };

  const load = (value: string, name: string | null) => {
    setText(value);
    setFileName(name);
    setFileError(null);
    if (value.trim()) validate(value);
    else {
      setItems(null);
      setSyntax(null);
    }
  };

  const readFile = async (file: File) => {
    if (!/\.json$/i.test(file.name) && file.type !== "application/json") return setFileError("Solo se aceptan archivos .json.");
    if (file.size > MAX_BYTES) return setFileError("El archivo supera 10 MB; divídelo en lotes más pequeños.");
    load(await file.text(), file.name);
  };

  const rows = React.useMemo(
    () => (items && catalogo ? reviewItems(items, { materias: getMaterias(), guia, catalogo, institucion: institucion ?? "" }) : []),
    [items, guia, catalogo, institucion]
  );
  // Carreras que sugiere el lote (areaCarrera de la guía y de cada reactivo) y que aún no están marcadas.
  const inst = catalogo && institucion ? findInstitucion(catalogo, institucion) : null;
  const sugeridas = React.useMemo(() => {
    if (!inst) return [];
    const areas = new Set([...(typeof guia?.areaCarrera === "string" ? [guia.areaCarrera] : []), ...rows.map((r) => r.areaCarrera).filter(Boolean)]);
    return [...new Set([...areas].flatMap((a) => carrerasSugeridas(inst, a)))];
  }, [inst, guia, rows]);
  const faltanSugeridas = sugeridas.filter((c) => !destinos.includes(c));
  const ready = Boolean(inst && destinos.length > 0);

  /** Guarda los cambios en el lote conservando el formato original (lista o { guia, reactivos }). */
  const commit = (next: unknown[]) => {
    const nextGuia = guia ? { ...guia, ...guiaTotals(next) } : null;
    setItems(next);
    setGuia(nextGuia);
    setText(JSON.stringify(nextGuia ? { guia: nextGuia, reactivos: next } : next, null, 2));
    setStatus({ kind: "idle" });
  };

  /** Reemplaza un reactivo por su versión reparada; devuelve el error de sintaxis si lo hay. */
  const repair = (index: number, json: string): string | null => {
    const parsed = parseJson(json);
    if (!parsed.ok) return `${parsed.syntaxError}${parsed.line ? ` (línea ${parsed.line})` : ""}`;
    const next = [...(items ?? [])];
    next[index] = parsed.data;
    commit(next);
    setEdited((e) => new Set(e).add(uids[index]));
    return null;
  };

  /** Quita un reactivo del lote (no toca el banco). */
  const remove = (index: number) => {
    commit((items ?? []).filter((_, i) => i !== index));
    setUids((u) => u.filter((_, i) => i !== index));
    setRemoved((n) => n + 1);
  };

  const downloadLote = () => {
    const blob = new Blob([text], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = (fileName ?? "lote.json").replace(/\.json$/i, "") + "_reparado.json";
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const valid = React.useMemo(() => rows.filter((r) => r.draft && !hasErrors(r.issues)), [rows]);
  const drafts = React.useMemo(() => valid.map((r) => ({ ...r.draft!, destinos })), [valid, destinos]);
  // Qué hay ya en el banco para estos códigos (se vuelve a consultar al terminar de importar).
  const codigosKey = valid.map((r) => r.id).join(",");
  const importedAt = status.kind === "done" || status.kind === "error" ? status : null;
  const [existentes, setExistentes] = React.useState<Map<string, Existente> | null>(null);
  const [planError, setPlanError] = React.useState<string | null>(null);
  React.useEffect(() => {
    void importedAt;
    const codigos = codigosKey ? codigosKey.split(",") : [];
    let alive = true;
    setExistentes(null);
    setPlanError(null);
    getExistentes(codigos)
      .then((m) => alive && setExistentes(m))
      .catch((e: unknown) => alive && setPlanError(e instanceof Error ? e.message : "No se pudo consultar el banco."));
    return () => {
      alive = false;
    };
  }, [codigosKey, importedAt]);
  const [plan, setPlan] = React.useState<{ kinds: Map<string, keyof ImportPlan>; counts: ImportPlan } | null>(null);
  React.useEffect(() => {
    if (!existentes) return setPlan(null);
    let alive = true;
    planImport(drafts, existentes).then((kinds) => {
      const counts: ImportPlan = { nuevas: 0, actualizadas: 0, sinCambios: 0 };
      kinds.forEach((k) => counts[k]++);
      if (alive) setPlan({ kinds, counts });
    });
    return () => {
      alive = false;
    };
  }, [drafts, existentes]);

  const materiasNuevas = [...new Map(rows.filter((r) => r.materiaNueva).map((r) => [r.materiaNueva!.clave, r.materiaNueva!])).values()];

  const counts = {
    error: rows.filter((r) => rowLevel(r) === "error").length,
    aviso: rows.filter((r) => rowLevel(r) === "aviso").length,
    ok: rows.filter((r) => rowLevel(r) === "ok").length,
    fix: rows.filter((r) => r.fixes.length).length,
  };
  const visible = rows.filter((r) => filter === "all" || (filter === "fix" ? r.fixes.length > 0 : rowLevel(r) === filter));

  const kinds = React.useMemo(() => {
    const map = new Map<string, { issue: Issue; ids: string[] }>();
    for (const r of rows)
      for (const i of r.issues) {
        const k = issueKind(i);
        const entry = map.get(k) ?? { issue: i, ids: [] };
        const label = r.id || `#${r.index + 1}`;
        if (!entry.ids.includes(label)) entry.ids.push(label);
        map.set(k, entry);
      }
    return [...map.values()].sort((a, b) =>
      a.issue.level === b.issue.level ? b.ids.length - a.ids.length : a.issue.level === "error" ? -1 : 1
    );
  }, [rows]);

  const runImport = async () => {
    if (!plan) return;
    const toWrite = drafts.filter((d) => plan.kinds.get(d.id) !== "sinCambios");
    const result: ImportPlan = { nuevas: 0, actualizadas: 0, sinCambios: plan.counts.sinCambios };
    setStatus({ kind: "importing", done: 0, total: toWrite.length });
    try {
      for (let i = 0; i < toWrite.length; i += CHUNK) {
        const r = await importChunk(toWrite.slice(i, i + CHUNK));
        result.nuevas += r.nuevas;
        result.actualizadas += r.actualizadas;
        result.sinCambios += r.sinCambios;
        setStatus({ kind: "importing", done: Math.min(i + CHUNK, toWrite.length), total: toWrite.length });
      }
    } catch (e) {
      // Los bloques anteriores ya quedaron guardados; al reintentar, esos saldrán "sin cambios".
      setStatus({ kind: "error", message: e instanceof Error ? e.message : "Error al guardar.", result });
      onImported();
      return;
    }
    const omitidas = rows.length - valid.length;
    await registrarLote({
      archivo: fileName ?? "lote.json",
      institucionId: inst?.id ?? null,
      carreras: destinos,
      total: rows.length,
      omitidas,
      resultado: result,
    }).catch(() => undefined);
    await loadMaterias().catch(() => undefined);
    setStatus({ kind: "done", result, omitidas });
    onImported();
  };

  const downloadReport = () => {
    const report = rows
      .filter((r) => r.issues.length || r.fixes.length)
      .map((r) => ({
        indice: r.index + 1,
        id: r.id,
        errores: r.issues.filter((i) => i.level === "error").map((i) => `${fieldLabel(i.field)}: ${i.message}`),
        avisos: r.issues.filter((i) => i.level === "aviso").map((i) => `${fieldLabel(i.field)}: ${i.message}`),
        correcciones: r.fixes,
      }));
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `reporte_${(fileName ?? "lote").replace(/\.json$/i, "")}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const preview = (row: ImportRow) => onPreview({ ...row.draft!, destinos, actualizado: "" });

  const busy = validating || status.kind === "importing";
  const toImport = plan ? plan.counts.nuevas + plan.counts.actualizadas : 0;

  return (
    <div className="flex flex-col gap-5">
      {/* 1. Asignación */}
      <Step
        n={1}
        title="Escuela y carreras"
        description="A qué universidad y carreras se asigna todo el lote. Una guía suele ser por área: marcar un área marca todas sus carreras."
      >
        {catalogoError ? (
          <p className="flex flex-wrap items-center gap-2 text-sm text-destructive" role="alert">
            <XCircle className="size-4" /> {catalogoError}
            <Button type="button" variant="outline" size="sm" onClick={reloadCatalogo}>
              <RefreshCw /> Reintentar
            </Button>
          </p>
        ) : !catalogo ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Cargando escuelas y carreras…
          </p>
        ) : (
          <CarrerasSelector
            id="lote-carreras"
            catalogo={catalogo}
            institucion={institucion}
            onInstitucionChange={setInstitucion}
            value={destinos}
            onChange={setDestinos}
            invalid={Boolean(institucion) && destinos.length === 0}
          />
        )}
        {institucion && destinos.length === 0 && <p className="text-sm text-destructive">Marca al menos una carrera.</p>}
      </Step>

      {/* 2. Archivo */}
      <Step n={2} title="Importar archivo JSON" description={ready ? undefined : "Primero elige la universidad y sus carreras."}>
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            const file = e.dataTransfer.files[0];
            if (file) readFile(file);
          }}
          className={cn(
            "flex flex-col items-center gap-3 rounded-xl border-2 border-dashed p-6 text-center transition-colors",
            dragging ? "border-secondary bg-secondary/10" : "bg-background/40",
            !ready && "pointer-events-none opacity-50"
          )}
          aria-disabled={!ready}
        >
          <span className="grid size-12 place-items-center rounded-xl bg-gold/15 text-gold">
            <FileUp className="size-6" />
          </span>
          <div>
            <p className="font-semibold">Arrastra aquí el lote .json</p>
            <p className="text-sm text-muted-foreground">{'{ "guia": {…}, "reactivos": […] }'} o lista de reactivos. Máximo 10 MB.</p>
          </div>
          <Button type="button" variant="outline" onClick={() => inputRef.current?.click()} disabled={busy || !ready}>
            <Upload /> Elegir archivo
          </Button>
          <input
            ref={inputRef}
            type="file"
            accept=".json,application/json"
            className="sr-only"
            tabIndex={-1}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) readFile(file);
              e.target.value = "";
            }}
          />
          {fileError && (
            <p className="flex items-center gap-1.5 text-sm text-destructive" role="alert">
              <XCircle className="size-4" /> {fileError}
            </p>
          )}
        </div>

        {text && (
          <details className="group rounded-xl border bg-background/40">
            <summary className="flex cursor-pointer list-none items-center gap-2 p-3 text-sm font-medium text-cool">
              <FileJson className="size-4 shrink-0 text-gold" />
              <span className="min-w-0 truncate">{fileName ?? "JSON"}</span>
              <span className="font-mono text-xs text-muted-foreground">{(new Blob([text]).size / 1024).toFixed(0)} KB</span>
              <span className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
                Ver / editar <ChevronDown className="size-4 transition-transform group-open:rotate-180" />
              </span>
            </summary>
            <div className="flex flex-col gap-2 border-t p-3">
              <Textarea
                aria-label="Contenido JSON del lote"
                value={text}
                onChange={(e) => setText(e.target.value)}
                spellCheck={false}
                className="min-h-72 font-mono text-xs leading-relaxed md:text-xs"
              />
              <Button type="button" variant="outline" size="sm" className="w-fit" onClick={() => validate(text)} disabled={busy}>
                <RefreshCw /> Revalidar
              </Button>
            </div>
          </details>
        )}
      </Step>

      {validating && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
          <Loader2 className="size-4 animate-spin" /> Validando reactivos y fórmulas…
        </p>
      )}

      {syntax && !validating && (
        <div className="flex items-start gap-3 rounded-2xl border border-destructive/50 bg-destructive/10 p-4 text-sm" role="alert">
          <XCircle className="mt-0.5 size-5 shrink-0 text-destructive" />
          <div>
            <p className="font-semibold">Error de sintaxis{syntax.line ? ` en la línea ${syntax.line}` : ""}</p>
            <p className="mt-1 font-mono text-xs break-words text-muted-foreground">{syntax.syntaxError}</p>
            <p className="mt-2 text-xs text-muted-foreground">Corrígelo en «Ver / editar» y presiona Revalidar.</p>
          </div>
        </div>
      )}

      {items && catalogo && !validating && (
        <>
          {/* 3. Validación */}
          <Step n={3} title="Validación">
            {guia && <GuiaCard guia={guia} issues={guiaIssues} />}
            <LoteSummary rows={rows} />
            {faltanSugeridas.length > 0 && (
              <p className="flex flex-wrap items-center gap-2 rounded-xl border border-gold/40 bg-gold/10 p-3 text-sm">
                <AlertTriangle className="size-4 shrink-0 text-gold" />
                El lote indica {faltanSugeridas.length} {faltanSugeridas.length === 1 ? "carrera" : "carreras"} de su área que no marcaste.
                <Button type="button" variant="outline" size="sm" onClick={() => setDestinos((d) => [...new Set([...d, ...faltanSugeridas])])}>
                  Marcarlas
                </Button>
              </p>
            )}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Stat label="Reactivos" value={rows.length} />
              <Stat label="Sin observaciones" value={counts.ok} tone="text-secondary" />
              <Stat label="Con avisos" value={counts.aviso} tone={counts.aviso ? "text-gold" : undefined} />
              <Stat label="Con errores" value={counts.error} tone={counts.error ? "text-destructive" : undefined} />
            </div>

            {materiasNuevas.length > 0 && (
              <p className="rounded-xl border border-gold/40 bg-gold/10 p-3 text-sm">
                Materias nuevas que se agregarán al catálogo:{" "}
                <span className="font-semibold">{materiasNuevas.map((m) => `${m.nombre} (${m.clave})`).join(", ")}</span>
              </p>
            )}

            {(kinds.length > 0 || counts.fix > 0) && (
              <div className="flex flex-col gap-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium text-cool">Resumen de observaciones</p>
                  <div className="flex flex-wrap gap-1">
                    {edited.size + removed > 0 && (
                      <Button type="button" variant="ghost" size="sm" onClick={downloadLote}>
                        <Download /> JSON reparado ({[edited.size && `${edited.size} ${edited.size === 1 ? "editado" : "editados"}`, removed && `${removed} ${removed === 1 ? "quitado" : "quitados"}`].filter(Boolean).join(", ")})
                      </Button>
                    )}
                    <Button type="button" variant="ghost" size="sm" onClick={downloadReport}>
                      <Download /> Descargar reporte
                    </Button>
                  </div>
                </div>
                {kinds.length > 0 && (
                  <ul className="flex flex-col divide-y rounded-xl border bg-background/40 text-sm">
                    {kinds.map(({ issue, ids }) => (
                      <li key={issueKind(issue)} className="flex items-start gap-2 p-2.5">
                        <IssueIcon level={issue.level} />
                        <div className="min-w-0 flex-1">
                          <p>
                            <span className="font-mono text-xs text-muted-foreground">{fieldLabel(issue.field.split(".")[0])}</span> {issue.message}
                          </p>
                          <p className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground" title={ids.join(", ")}>
                            {ids.slice(0, 6).join(", ")}
                            {ids.length > 6 && ` +${ids.length - 6}`}
                          </p>
                        </div>
                        <span className="shrink-0 rounded-full bg-muted px-2 font-mono text-xs tabular-nums">{ids.length}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none" role="tablist" aria-label="Filtrar reactivos">
              {(
                [
                  ["all", "Todos", rows.length],
                  ["error", "Errores", counts.error],
                  ["aviso", "Avisos", counts.aviso],
                  ["fix", "Corregidos", counts.fix],
                  ["ok", "Sin observaciones", counts.ok],
                ] as const
              ).map(([id, label, n]) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={filter === id}
                  onClick={() => {
                    setFilter(id);
                    setLimit(PAGE);
                  }}
                  className={cn(
                    "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-medium",
                    filter === id ? "border-secondary bg-secondary/15" : "text-muted-foreground hover:bg-accent"
                  )}
                >
                  {label} <span className="font-mono tabular-nums">{n}</span>
                </button>
              ))}
            </div>

            <ul className="flex flex-col gap-2">
              {visible.slice(0, limit).map((row) => (
                <RowItem
                  key={uids[row.index]}
                  row={row}
                  raw={items[row.index]}
                  edited={edited.has(uids[row.index])}
                  onRemove={() => remove(row.index)}
                  kind={plan?.kinds.get(row.id)}
                  onPreview={() => preview(row)}
                  onRepair={(json) => repair(row.index, json)}
                />
              ))}
            </ul>
            {visible.length > limit && (
              <Button type="button" variant="ghost" size="sm" className="self-center" onClick={() => setLimit((l) => l + PAGE)}>
                Mostrar {Math.min(PAGE, visible.length - limit)} más de {visible.length - limit}
              </Button>
            )}
          </Step>

          {/* 4. Guardado */}
          <div className="sticky bottom-0 z-10 -mx-4 flex flex-col gap-3 border-t bg-background/90 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-2xl sm:border">
            {status.kind === "importing" && (
              <div
                className="h-1.5 overflow-hidden rounded-full bg-muted"
                role="progressbar"
                aria-label="Progreso de importación"
                aria-valuenow={status.done}
                aria-valuemax={status.total}
              >
                <div className="h-full bg-secondary transition-[width]" style={{ width: `${(status.done / Math.max(1, status.total)) * 100}%` }} />
              </div>
            )}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="text-sm sm:mr-auto" role="status">
                {status.kind === "done" ? (
                  <p className="flex items-center gap-1.5 text-secondary">
                    <CheckCircle2 className="size-4 shrink-0" /> Listo: {status.result.nuevas} nuevas, {status.result.actualizadas}{" "}
                    actualizadas, {status.result.sinCambios} sin cambios
                    {status.omitidas ? `, ${status.omitidas} omitidas por errores` : ""}.
                  </p>
                ) : status.kind === "importing" ? (
                  <p className="text-muted-foreground">
                    Guardando en bloques de {CHUNK}: {status.done} de {status.total}…
                  </p>
                ) : status.kind === "error" ? (
                  <p className="flex items-start gap-1.5 text-destructive" role="alert">
                    <XCircle className="mt-0.5 size-4 shrink-0" />
                    <span>
                      Se detuvo: {status.message} Ya se guardaron {status.result.nuevas} nuevas y {status.result.actualizadas} actualizadas;
                      puedes reintentar sin duplicar.
                    </span>
                  </p>
                ) : planError ? (
                  <p className="text-destructive">No se pudo consultar el banco: {planError}</p>
                ) : !plan ? (
                  <p className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="size-4 animate-spin" /> Comparando con el banco…
                  </p>
                ) : (
                  <p className="text-muted-foreground">
                    Se guardarán <span className="font-semibold text-foreground">{plan.counts.nuevas} nuevas</span> y{" "}
                    <span className="font-semibold text-foreground">{plan.counts.actualizadas} actualizadas</span>
                    {plan.counts.sinCambios > 0 && `; ${plan.counts.sinCambios} sin cambios no se reescriben`}
                    {counts.error > 0 && <span className="text-destructive">; {counts.error} con errores se omiten</span>}
                    {removed > 0 && `; ${removed} ${removed === 1 ? "quitado" : "quitados"} del lote`}.
                  </p>
                )}
              </div>
              <Button type="button" size="lg" disabled={busy || !ready || status.kind === "done" || toImport === 0} onClick={runImport}>
                {status.kind === "importing" ? <Loader2 className="animate-spin" /> : <Upload />} Importar {toImport} reactivos
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Step({ n, title, description, children }: { n: number; title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4 rounded-2xl border bg-card p-4 sm:p-5">
      <header className="flex gap-3">
        <span className="grid size-7 shrink-0 place-items-center rounded-full bg-gold/15 font-mono text-sm font-bold text-gold">{n}</span>
        <div>
          <h3 className="font-semibold">{title}</h3>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
      </header>
      {children}
    </section>
  );
}

function LoteSummary({ rows }: { rows: ImportRow[] }) {
  const groups = new Map<string, number>();
  for (const r of rows) {
    const key = `${r.draft?.institucion ?? "?"} · ${r.areaCarrera || "sin área"} · ${r.draft?.materia ?? "?"}`;
    groups.set(key, (groups.get(key) ?? 0) + 1);
  }
  return (
    <details className="rounded-xl border bg-background/40 text-sm">
      <summary className="cursor-pointer p-3 text-muted-foreground">
        Contenido del lote según configuracionExamen ({groups.size} {groups.size === 1 ? "combinación" : "combinaciones"})
      </summary>
      <ul className="flex flex-col gap-1 border-t p-3">
        {[...groups].map(([k, n]) => (
          <li key={k} className="flex justify-between gap-3">
            <span className="min-w-0 text-cool">{k}</span>
            <span className="font-mono text-xs text-muted-foreground">{n}</span>
          </li>
        ))}
      </ul>
    </details>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div className="rounded-xl border bg-background/40 px-2 py-3 text-center">
      <p className={cn("font-display text-2xl font-bold tabular-nums", tone)}>{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function IssueIcon({ level }: { level: Issue["level"] | "fix" }) {
  if (level === "error") return <XCircle className="mt-0.5 size-4 shrink-0 text-destructive" />;
  if (level === "aviso") return <AlertTriangle className="mt-0.5 size-4 shrink-0 text-gold" />;
  return <Wrench className="mt-0.5 size-4 shrink-0 text-brand-light" />;
}

const KIND_LABEL: Record<keyof ImportPlan, string> = { nuevas: "Nueva", actualizadas: "Actualiza", sinCambios: "Sin cambios" };

function RowItem({
  row,
  raw,
  edited,
  kind,
  onPreview,
  onRepair,
  onRemove,
}: {
  row: ImportRow;
  raw: unknown;
  edited: boolean;
  kind?: keyof ImportPlan;
  onPreview: () => void;
  /** Aplica el JSON reparado; devuelve el error de sintaxis o null. */
  onRepair: (json: string) => string | null;
  onRemove: () => void;
}) {
  const level = rowLevel(row);
  const d = row.draft;
  const [repairing, setRepairing] = React.useState(false);
  return (
    <li className={cn("rounded-xl border p-3 text-sm", level === "error" ? "border-destructive/50 bg-destructive/5" : "bg-background/40")}>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        {level === "error" ? (
          <XCircle className="size-4 text-destructive" />
        ) : level === "aviso" ? (
          <AlertTriangle className="size-4 text-gold" />
        ) : (
          <CheckCircle2 className="size-4 text-secondary" />
        )}
        <span className="font-mono text-muted-foreground">#{row.index + 1}</span>
        <span className="font-mono text-gold">{row.id || "sin id"}</span>
        {d?.dificultad && <DifficultyBadge value={d.dificultad} />}
        {kind && level !== "error" && (
          <span
            className={cn(
              "rounded-md px-1.5 py-0.5 font-medium",
              kind === "nuevas" ? "bg-secondary/15 text-secondary" : "bg-muted text-muted-foreground"
            )}
          >
            {KIND_LABEL[kind]}
          </span>
        )}
        {edited && <span className="rounded-md bg-brand-light/15 px-1.5 py-0.5 font-medium text-brand-light">Editado a mano</span>}
        <span className="ml-auto flex gap-1">
          <Button type="button" variant="ghost" size="sm" className="h-7" onClick={() => setRepairing((r) => !r)} aria-expanded={repairing}>
            <Hammer /> {level === "ok" ? "Editar" : "Reparar"}
          </Button>
          {level !== "ok" && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 hover:text-destructive"
              onClick={onRemove}
              title="Quitar del lote (no se importa; el banco no cambia)"
            >
              <Trash2 /> Quitar
            </Button>
          )}
          {d && level !== "error" && (
            <Button type="button" variant="ghost" size="sm" className="h-7" onClick={onPreview}>
              <Eye /> Vista previa
            </Button>
          )}
        </span>
      </div>
      {d?.pregunta && <MathText text={d.pregunta} className="mt-2 line-clamp-2 block text-cool" />}
      {(row.issues.length > 0 || row.fixes.length > 0) && (
        <ul className="mt-2 flex flex-col gap-1 text-xs">
          {row.issues.map((i, n) => (
            <li key={n} className="flex items-start gap-1.5">
              <IssueIcon level={i.level} />
              <span>
                <span className="font-mono text-muted-foreground">{fieldLabel(i.field)}</span> {i.message}
              </span>
            </li>
          ))}
          {row.fixes.map((f, n) => (
            <li key={`f${n}`} className="flex items-start gap-1.5 text-muted-foreground">
              <IssueIcon level="fix" /> {f}
            </li>
          ))}
        </ul>
      )}
      {repairing && <RepairEditor raw={raw} onApply={onRepair} onClose={() => setRepairing(false)} />}
    </li>
  );
}

/** Editor del JSON de un solo reactivo: se aplica sobre el lote y se revalida al momento. */
function RepairEditor({ raw, onApply, onClose }: { raw: unknown; onApply: (json: string) => string | null; onClose: () => void }) {
  const [value, setValue] = React.useState(() => JSON.stringify(raw, null, 2));
  const [error, setError] = React.useState<string | null>(null);
  const id = React.useId();

  return (
    <div className="mt-3 flex flex-col gap-2 border-t pt-3">
      <label htmlFor={id} className="text-xs font-medium text-cool">
        JSON del reactivo: corrige el texto y aplica; las fórmulas van entre (form) y (/form).
      </label>
      <Textarea
        id={id}
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setError(null);
        }}
        spellCheck={false}
        aria-invalid={Boolean(error)}
        rows={Math.min(24, value.split("\n").length + 1)}
        className="font-mono text-xs leading-relaxed md:text-xs"
      />
      {error && (
        <p className="flex items-start gap-1.5 text-xs text-destructive" role="alert">
          <XCircle className="mt-px size-3.5 shrink-0" /> {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" onClick={() => setError(onApply(value))}>
          <RefreshCw /> Aplicar y revalidar
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onClose}>
          Cerrar
        </Button>
      </div>
    </div>
  );
}

/** Datos del bloque "guia" y si sus totales coinciden con el contenido real del archivo. */
function GuiaCard({ guia, issues }: { guia: Guia; issues: string[] }) {
  const field = (k: string) => (typeof guia[k] === "string" || typeof guia[k] === "number" ? String(guia[k]) : null);
  const fecha = field("fechaValidacion");
  return (
    <div className="flex flex-col gap-2 rounded-xl border bg-background/40 p-3 text-sm">
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <FileJson className="size-4 text-gold" />
        <span className="font-semibold">Guía del lote</span>
        <span className="text-muted-foreground">
          {[field("claveInstitucion"), field("areaCarrera"), field("fuente")].filter(Boolean).join(" · ")}
        </span>
        {guia.validado === true && (
          <span className="rounded-md bg-secondary/15 px-1.5 py-0.5 text-xs font-medium text-secondary">
            Validado{fecha ? ` ${new Date(fecha).toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" })}` : ""}
          </span>
        )}
      </p>
      <p className="text-xs text-muted-foreground">
        {field("totalReactivos")} reactivos · {field("reactivosBase")} base (V01) · {field("variantes")} variantes
      </p>
      {issues.length === 0 ? (
        <p className="flex items-center gap-1.5 text-xs text-secondary">
          <CheckCircle2 className="size-3.5" /> Los totales de la guía coinciden con el contenido (por materia y por dificultad).
        </p>
      ) : (
        <ul className="flex flex-col gap-1 text-xs">
          {issues.map((i) => (
            <li key={i} className="flex items-start gap-1.5">
              <AlertTriangle className="mt-px size-3.5 shrink-0 text-gold" /> {i}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
