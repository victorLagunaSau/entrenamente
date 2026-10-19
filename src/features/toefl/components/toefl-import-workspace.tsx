"use client";

import * as React from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileArchive,
  FileAudio,
  Loader2,
  RefreshCw,
  Upload,
  XCircle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { AdminPageHeader } from "@/features/admin/components/admin-module";
import { cn } from "@/lib/utils";

import { EXAMPLE_MANIFEST, hasErrors, type Issue } from "../lib/manifest";
import {
  type InventarioToefl,
  type LoteToefl,
  type Paquete,
  type Progreso,
  type ResultadoImport,
  getInventario,
  getLotes,
  importPaquete,
  readPaquete,
} from "../services/toefl-import-service";
import { AGE_RANGE_LABEL, AGE_RANGES, MCER_LEVELS, SECTION_LABEL, SECTIONS } from "../types";

const mb = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;

/** /admin/toefl-import: carga de paquetes .zip (manifest.json + audios/) e inventario del banco TOEFL. */
export function ToeflImportWorkspace() {
  const [version, setVersion] = React.useState(0);

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader
        eyebrow="/admin/toefl-import"
        title="TOEFL ITP"
        description="Importación por paquete .zip (manifest.json + audios MP3) e inventario por edad, nivel MCER y sección."
      />
      <ImportCard onImported={() => setVersion((v) => v + 1)} />
      <InventoryCard version={version} />
    </div>
  );
}

/* ─────────────────────────── Importación ─────────────────────────── */

function ImportCard({ onImported }: { onImported: () => void }) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [paquete, setPaquete] = React.useState<Paquete | null>(null);
  const [reading, setReading] = React.useState(false);
  const [fileError, setFileError] = React.useState<string | null>(null);
  const [progress, setProgress] = React.useState<Progreso | null>(null);
  const [result, setResult] = React.useState<ResultadoImport | null>(null);
  const [importError, setImportError] = React.useState<string | null>(null);
  const [dragging, setDragging] = React.useState(false);

  const busy = reading || progress !== null;

  async function open(file: File) {
    setFileError(null);
    setImportError(null);
    setResult(null);
    setPaquete(null);
    if (!/\.zip$/i.test(file.name)) {
      setFileError("Elige un archivo .zip.");
      return;
    }
    setReading(true);
    try {
      setPaquete(await readPaquete(file));
    } catch (e) {
      setFileError((e as Error).message);
    } finally {
      setReading(false);
    }
  }

  async function run() {
    if (!paquete) return;
    setImportError(null);
    try {
      const r = await importPaquete(paquete, setProgress);
      setResult(r);
      setPaquete(null);
      onImported();
    } catch (e) {
      setImportError((e as Error).message);
    } finally {
      setProgress(null);
    }
  }

  function downloadExample() {
    const blob = new Blob([JSON.stringify(EXAMPLE_MANIFEST, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement("a"), { href: url, download: "manifest.json" });
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="flex flex-col gap-4 rounded-2xl border bg-card p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="font-semibold">Importar paquete</h2>
          <p className="text-sm text-muted-foreground">
            Si falta un MP3 o una pregunta no pasa la validación, no se importa nada.
          </p>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={downloadExample}>
          <Download /> manifest.json de ejemplo
        </Button>
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!busy) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const file = e.dataTransfer.files?.[0];
          if (file && !busy) open(file);
        }}
        className={cn(
          "flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed p-6 text-center transition-colors",
          dragging ? "border-gold bg-gold/10" : "border-border"
        )}
      >
        <span className="grid size-12 place-items-center rounded-xl bg-gold/15 text-gold">
          {reading ? <Loader2 className="size-6 animate-spin" /> : <FileArchive className="size-6" />}
        </span>
        <div>
          <p className="font-semibold">{reading ? "Abriendo paquete…" : "Arrastra aquí el paquete .zip"}</p>
          <pre className="mt-2 inline-block rounded-lg bg-muted/50 px-3 py-2 text-left font-mono text-[11px] leading-relaxed text-muted-foreground">
            {"paquete_toefl.zip\n├── manifest.json\n└── audios/\n    └── AUD-TOEFL-LIST-1001.mp3"}
          </pre>
        </div>
        <Button type="button" variant="outline" onClick={() => inputRef.current?.click()} disabled={busy}>
          <Upload /> Elegir archivo
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept=".zip,application/zip,application/x-zip-compressed"
          className="sr-only"
          tabIndex={-1}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) open(file);
            e.target.value = "";
          }}
        />
        {fileError && (
          <p className="flex items-center gap-1.5 text-sm text-destructive" role="alert">
            <XCircle className="size-4 shrink-0" /> {fileError}
          </p>
        )}
      </div>

      {result && (
        <p className="flex items-start gap-2 rounded-xl border border-secondary/40 bg-secondary/10 p-3 text-sm" role="status">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-secondary" />
          <span>
            Paquete importado: {result.total} preguntas ({result.nuevas} nuevas, {result.actualizadas} actualizadas),{" "}
            {result.audios} audios y {result.pasajes} pasajes.
          </span>
        </p>
      )}

      {paquete && (
        <PaqueteReview
          paquete={paquete}
          progress={progress}
          error={importError}
          onImport={run}
          onReset={() => {
            setPaquete(null);
            setImportError(null);
          }}
        />
      )}
    </section>
  );
}

function PaqueteReview({
  paquete,
  progress,
  error,
  onImport,
  onReset,
}: {
  paquete: Paquete;
  progress: Progreso | null;
  error: string | null;
  onImport: () => void;
  onReset: () => void;
}) {
  const blocked = hasErrors(paquete);
  const errores = paquete.issues.filter((i) => i.level === "error");
  const avisos = paquete.issues.filter((i) => i.level === "aviso");
  const conAudio = paquete.assets.filter((a) => a.audio_key).length;
  const pasajes = paquete.assets.length - conAudio;

  // Preguntas válidas por sección × nivel.
  const grid = React.useMemo(() => {
    const m = new Map<string, number>();
    for (const q of paquete.items) m.set(`${q.section}|${q.mcer_level}`, (m.get(`${q.section}|${q.mcer_level}`) ?? 0) + 1);
    return m;
  }, [paquete.items]);
  const niveles = MCER_LEVELS.filter((l) => SECTIONS.some((s) => grid.has(`${s}|${l}`)));
  const edades = AGE_RANGES.filter((a) => paquete.items.some((q) => q.age_range === a));

  return (
    <div className="flex flex-col gap-4 border-t pt-4">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <FileArchive className="size-4 text-gold" />
        <span className="min-w-0 truncate font-medium">{paquete.archivo}</span>
        {edades.map((a) => (
          <span key={a} className="rounded-md bg-muted px-1.5 py-0.5 text-xs">
            {AGE_RANGE_LABEL[a]}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Preguntas válidas" value={`${paquete.items.length}/${paquete.total}`} tone={blocked ? "text-destructive" : "text-secondary"} />
        <Stat label="Audios" value={conAudio} hint={mb(paquete.audioBytes)} />
        <Stat label="Pasajes" value={pasajes} />
        <Stat label="Errores" value={errores.length} tone={errores.length ? "text-destructive" : undefined} />
      </div>

      {paquete.missingAudios.length > 0 && (
        <div className="flex items-start gap-3 rounded-xl border border-destructive/50 bg-destructive/10 p-3 text-sm" role="alert">
          <FileAudio className="mt-0.5 size-5 shrink-0 text-destructive" />
          <div className="min-w-0">
            <p className="font-semibold">
              {paquete.missingAudios.length === 1 ? "Falta 1 audio" : `Faltan ${paquete.missingAudios.length} audios`} en audios/
            </p>
            <p className="mt-1 font-mono text-xs break-words text-muted-foreground">
              {paquete.missingAudios.map((k) => `${k}.mp3`).join(", ")}
            </p>
          </div>
        </div>
      )}

      {niveles.length > 0 && (
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full text-sm tabular-nums">
            <thead className="bg-muted/40 text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Sección</th>
                {niveles.map((l) => (
                  <th key={l} className="px-3 py-2 text-right font-medium">
                    {l}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {SECTIONS.map((s) => (
                <tr key={s}>
                  <td className="px-3 py-2">{SECTION_LABEL[s]}</td>
                  {niveles.map((l) => (
                    <td key={l} className="px-3 py-2 text-right">
                      {grid.get(`${s}|${l}`) ?? <span className="text-muted-foreground">—</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {errores.length > 0 && <IssueList title="Errores (bloquean la importación)" issues={errores} />}
      {avisos.length > 0 && <IssueList title="Avisos" issues={avisos} collapsed />}

      {error && (
        <p className="flex items-start gap-2 rounded-xl border border-destructive/50 bg-destructive/10 p-3 text-sm" role="alert">
          <XCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
          <span>
            No se importó nada: {error}
          </span>
        </p>
      )}

      {progress && (
        <div className="flex flex-col gap-1.5" role="status">
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            {progress.fase === "audios" ? `Subiendo audios ${progress.hechos}/${progress.total}…` : `Guardando ${progress.total} preguntas…`}
          </p>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-gold transition-all"
              style={{
                width: `${progress.fase === "audios" ? (progress.total ? (progress.hechos / progress.total) * 90 : 90) : 95}%`,
              }}
            />
          </div>
        </div>
      )}

      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onReset} disabled={Boolean(progress)}>
          Descartar
        </Button>
        <Button type="button" onClick={onImport} disabled={blocked || Boolean(progress)}>
          {progress ? <Loader2 className="animate-spin" /> : <Upload />}
          Importar {paquete.items.length} {paquete.items.length === 1 ? "pregunta" : "preguntas"}
        </Button>
      </div>
    </div>
  );
}

function IssueList({ title, issues, collapsed }: { title: string; issues: Issue[]; collapsed?: boolean }) {
  const shown = issues.slice(0, 200);
  return (
    <details className="group rounded-xl border bg-background/40 text-sm" open={!collapsed}>
      <summary className="flex cursor-pointer list-none items-center gap-2 p-3 font-medium">
        {issues[0].level === "error" ? (
          <XCircle className="size-4 shrink-0 text-destructive" />
        ) : (
          <AlertTriangle className="size-4 shrink-0 text-gold" />
        )}
        {title}
        <span className="ml-auto rounded-full bg-muted px-2 font-mono text-xs tabular-nums">{issues.length}</span>
      </summary>
      <ul className="max-h-80 divide-y overflow-y-auto border-t">
        {shown.map((issue, i) => (
          <li key={i} className="flex flex-col gap-0.5 px-3 py-2 sm:flex-row sm:gap-3">
            {issue.id && <span className="shrink-0 font-mono text-xs text-muted-foreground sm:w-56 sm:truncate">{issue.id}</span>}
            <span>{issue.message}</span>
          </li>
        ))}
        {issues.length > shown.length && (
          <li className="px-3 py-2 text-xs text-muted-foreground">+{issues.length - shown.length} más</li>
        )}
      </ul>
    </details>
  );
}

function Stat({ label, value, hint, tone }: { label: string; value: React.ReactNode; hint?: string; tone?: string }) {
  return (
    <div className="rounded-xl border bg-background/40 px-2 py-3 text-center">
      <p className={cn("text-xl font-bold tabular-nums", tone)}>{value}</p>
      <p className="text-xs text-muted-foreground">
        {label}
        {hint && <span className="block font-mono text-[11px]">{hint}</span>}
      </p>
    </div>
  );
}

/* ─────────────────────────── Inventario ─────────────────────────── */

function InventoryCard({ version }: { version: number }) {
  const [inv, setInv] = React.useState<InventarioToefl | null>(null);
  const [lotes, setLotes] = React.useState<LoteToefl[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);

  const load = React.useCallback(() => {
    setLoading(true);
    setError(null);
    Promise.all([getInventario(), getLotes()])
      .then(([i, l]) => {
        setInv(i);
        setLotes(l);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  React.useEffect(load, [load, version]);

  const cell = (age: string, level: string, section: string) =>
    inv?.celdas.find((c) => c.age_range === age && c.mcer_level === level && c.section === section)?.total ?? 0;

  return (
    <section className="flex flex-col gap-4 rounded-2xl border bg-card p-4 sm:p-5">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="font-semibold">Inventario</h2>
          <p className="text-sm text-muted-foreground">Preguntas activas por edad, nivel MCER y sección (L · S · R).</p>
        </div>
        <Button type="button" variant="ghost" size="icon" onClick={load} disabled={loading} aria-label="Actualizar inventario">
          <RefreshCw className={cn(loading && "animate-spin")} />
        </Button>
      </div>

      {error && (
        <p className="flex items-center gap-2 text-sm text-destructive" role="alert">
          <XCircle className="size-4 shrink-0" /> {error}
        </p>
      )}

      {inv && (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat label="Activas" value={inv.total} />
            <Stat label="Inactivas" value={inv.inactivas} />
            <Stat label="Audios" value={inv.audios} />
            <Stat label="Pasajes" value={inv.pasajes} />
          </div>

          <div className="overflow-x-auto rounded-xl border">
            <table className="w-full min-w-[520px] text-sm tabular-nums">
              <thead className="bg-muted/40 text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Edad</th>
                  {MCER_LEVELS.map((l) => (
                    <th key={l} className="px-2 py-2 text-center font-medium">
                      {l}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {AGE_RANGES.map((a) => (
                  <tr key={a}>
                    <td className="px-3 py-2 whitespace-nowrap">{AGE_RANGE_LABEL[a]}</td>
                    {MCER_LEVELS.map((l) => {
                      const counts = SECTIONS.map((s) => cell(a, l, s));
                      const sum = counts.reduce((x, y) => x + y, 0);
                      return (
                        <td key={l} className="px-2 py-2 text-center" title={SECTIONS.map((s, i) => `${SECTION_LABEL[s]}: ${counts[i]}`).join(" · ")}>
                          {sum ? (
                            <span className="font-mono text-xs">{counts.join(" · ")}</span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {lotes.length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium">Últimos paquetes</p>
              <ul className="divide-y rounded-xl border text-sm">
                {lotes.map((l) => (
                  <li key={l.id} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 px-3 py-2">
                    <span className="min-w-0 flex-1 truncate font-medium">{l.archivo}</span>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {l.total} preguntas · {l.nuevas} nuevas · {l.audios} audios
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(l.created_at).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" })}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </section>
  );
}
