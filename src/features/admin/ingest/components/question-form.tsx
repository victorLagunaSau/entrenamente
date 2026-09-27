"use client";

import * as React from "react";
import { AlertTriangle, CheckCircle2, Eye, Loader2, Plus, Save, Sigma, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { scoreTone } from "@/features/exam/components/exam-question";
import { MathText } from "@/features/exam/components/math-text";
import { FORM_CLOSE, FORM_OPEN } from "@/features/exam/lib/form-tags";
import { type Dificultad, PONDERACIONES, type Ponderacion, type Respuesta, formatScore } from "@/features/exam/types";
import { useMode } from "@/features/modes/components/mode-guard";
import { FormField } from "@/features/registro/components/form-field";
import { cn } from "@/lib/utils";

import { DIFICULTADES } from "../lib/catalog";
import { useCatalogo } from "../lib/use-catalogo";
import { type Issue, fieldLabel, reviewPregunta } from "../lib/validation";
import { codigoExiste, getMaterias, saveQuestion } from "../services/questions-service";
import type { Pregunta, PreguntaDraft } from "../types";
import { CarrerasSelector } from "./carreras-selector";
import { NativeSelect, Textarea } from "./fields";

const emptyRespuesta = (id: number, ponderacion: Ponderacion = 0): Respuesta => ({ id, texto: "", ponderacion, diagnosticoError: "" });

export const emptyDraft = (): PreguntaDraft => ({
  id: "",
  institucion: "",
  materia: "",
  fuente: "",
  fuenteDetallada: "",
  valorPuntos: 1,
  dificultad: "media",
  lecturaAsociada: null,
  pregunta: "",
  respuestas: [emptyRespuesta(0, 1), emptyRespuesta(1), emptyRespuesta(2), emptyRespuesta(3)],
  solucionPasoAPaso: [""],
  variantesAsociadas: [],
  destinos: [],
});

const toDraft = (q: Pregunta): PreguntaDraft => {
  const { actualizado, ...draft } = q;
  void actualizado;
  return { ...draft, solucionPasoAPaso: draft.solucionPasoAPaso.length ? draft.solucionPasoAPaso : [""] };
};

/** La correcta no lleva diagnóstico; los vacíos se guardan como null. */
/** Fuente cuando la pregunta no viene de una guía. */
export const FUENTE_PROPIA = "Desarrollada por Entrena Mente";
/** Fuente detallada por omisión: la clave (alias) de quien la capturó. */
export const fuenteDetalladaDe = (autor: string) => `Capturada por ${autor}`;

/** Normaliza antes de validar/guardar; las fuentes vacías toman los valores por omisión. */
const clean = (d: PreguntaDraft, autor: string): PreguntaDraft => ({
  ...d,
  id: d.id.trim().toUpperCase(),
  fuente: d.fuente.trim() || FUENTE_PROPIA,
  fuenteDetallada: d.fuenteDetallada.trim() || fuenteDetalladaDe(autor),
  pregunta: d.pregunta.trim(),
  lecturaAsociada: d.lecturaAsociada?.trim() ? d.lecturaAsociada : null,
  respuestas: d.respuestas.map((r) => ({
    ...r,
    texto: r.texto.trim(),
    diagnosticoError: r.ponderacion === 1 || !r.diagnosticoError?.trim() ? null : r.diagnosticoError.trim(),
  })),
  solucionPasoAPaso: d.solucionPasoAPaso.map((p) => p.trim()).filter(Boolean),
});

/**
 * Alta (pestaña "+ Pregunta", `editing` null) o edición (ventana desde el catálogo).
 * En alta, al guardar se limpia el reactivo pero se conserva la clasificación para capturar la siguiente.
 */
export function QuestionForm({
  editing,
  onSaved,
  onPreview,
  inDialog,
}: {
  editing: Pregunta | null;
  onSaved: (q: Pregunta) => void;
  /** Vista previa del borrador, aunque no esté guardado. */
  onPreview: (q: Pregunta) => void;
  /** Dentro de la ventana de edición: sin encabezado propio y pie pegado al borde de la ventana. */
  inDialog?: boolean;
}) {
  const [draft, setDraft] = React.useState<PreguntaDraft>(() => (editing ? toDraft(editing) : emptyDraft()));
  const isNew = !editing;
  const [submitted, setSubmitted] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [savedId, setSavedId] = React.useState<string | null>(null);
  // ID que la base reportó como ya existente (alta nueva) y error de guardado.
  const [idTaken, setIdTaken] = React.useState<string | null>(null);
  const [saveError, setSaveError] = React.useState<string | null>(null);
  const materias = getMaterias();
  const { catalogo } = useCatalogo();
  const { viewer } = useMode();
  // Prefijo de ids: el alta (pestaña) y la edición (ventana) están montadas a la vez y no deben repetir ids.
  const px = inDialog ? "qe" : "q";
  const autor = viewer.alias || viewer.email;

  const issues = React.useMemo(() => {
    const list = reviewPregunta(clean(draft, autor), { catalogo: catalogo ?? [] });
    if (isNew && idTaken === draft.id.trim().toUpperCase())
      list.unshift({ level: "error", field: "id", message: "Ya existe una pregunta con este ID." });
    return list;
  }, [draft, isNew, catalogo, idTaken, autor]);
  const errors = submitted ? firstByField(issues.filter((i) => i.level === "error")) : {};
  const avisos = issues.filter((i) => i.level === "aviso");

  const set = (patch: Partial<PreguntaDraft>) => {
    setDraft((d) => ({ ...d, ...patch }));
    setSavedId(null);
  };
  const setRespuesta = (i: number, patch: Partial<Respuesta>) =>
    set({ respuestas: draft.respuestas.map((r, j) => (j === i ? { ...r, ...patch } : r)) });
  const setPaso = (i: number, value: string) => set({ solucionPasoAPaso: draft.solucionPasoAPaso.map((p, j) => (j === i ? value : p)) });

  const focusFirstError = () => {
    const first = issues.find((i) => i.level === "error");
    if (!first) return;
    const parts = first.field.split(".");
    const el =
      document.getElementById(`${px}-${parts.join("-")}`) ?? document.getElementById(`${px}-${parts.slice(0, 2).join("-")}`) ?? document.getElementById(`${px}-${parts[0]}`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
    el?.focus({ preventScroll: true });
  };
  const hasErrors = issues.some((i) => i.level === "error");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    if (hasErrors) return focusFirstError();
    setSaving(true);
    setSaveError(null);
    const payload = clean(draft, autor);
    let saved: Pregunta;
    try {
      if (isNew && (await codigoExiste(payload.id))) {
        setIdTaken(payload.id);
        setSaving(false);
        document.getElementById(`${px}-id`)?.focus();
        return;
      }
      saved = await saveQuestion(payload);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "No se pudo guardar.");
      setSaving(false);
      return;
    }
    setSaving(false);
    setSubmitted(false);
    setSavedId(saved.id);
    if (isNew) {
      // Siguiente captura: misma clasificación y carreras, reactivo en blanco.
      const { institucion, materia, dificultad, fuente, valorPuntos, destinos } = draft;
      setDraft({ ...emptyDraft(), institucion, materia, dificultad, fuente, valorPuntos, destinos });
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else setDraft(toDraft(saved));
    onSaved(saved);
  };

  const preview = () => {
    setSubmitted(true);
    if (hasErrors) return focusFirstError();
    onPreview({ ...clean(draft, autor), actualizado: new Date().toISOString() });
  };

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5">
      {!inDialog && (
        <div>
          <h2 className="text-lg font-semibold">Nueva pregunta</h2>
          <p className="text-sm text-muted-foreground">
            Alta manual de un reactivo en el formato estándar del banco. Para editar, búscala en el Catálogo.
          </p>
        </div>
      )}

      {/* Identificación */}
      <Section title="Identificación">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <FormField
            id={`${px}-id`}
            label="ID"
            error={errors.id}
            hint="INSTITUCIÓN-ÁREA-MATERIA-000-V00"
            className="sm:col-span-2"
          >
            {(a11y) => (
              <Input
                {...a11y}
                value={draft.id}
                readOnly={!isNew}
                onChange={(e) => set({ id: e.target.value.toUpperCase() })}
                placeholder="UNAM-A1-MAT-007-V03"
                className="font-mono"
              />
            )}
          </FormField>
          <FormField id={`${px}-institucion`} label="Institución" error={errors.institucion}>
            {(a11y) => (
              <NativeSelect
                {...a11y}
                value={draft.institucion}
                onChange={(e) => set({ institucion: e.target.value, destinos: [] })}
                disabled={!catalogo}
              >
                <option value="" disabled>
                  {catalogo ? "Elige…" : "Cargando…"}
                </option>
                {catalogo?.map((i) => (
                  <option key={i.id} value={i.clave}>
                    {i.clave}
                  </option>
                ))}
              </NativeSelect>
            )}
          </FormField>
          <FormField id={`${px}-materia`} label="Materia" error={errors.materia}>
            {(a11y) => (
              <NativeSelect {...a11y} value={draft.materia} onChange={(e) => set({ materia: e.target.value })}>
                <option value="" disabled>
                  Elige…
                </option>
                {materias.map((m) => (
                  <option key={m.clave} value={m.clave}>
                    {m.nombre} ({m.clave})
                  </option>
                ))}
              </NativeSelect>
            )}
          </FormField>
          <FormField id={`${px}-dificultad`} label="Dificultad" error={errors.dificultad}>
            {(a11y) => (
              <NativeSelect {...a11y} value={draft.dificultad} onChange={(e) => set({ dificultad: e.target.value as Dificultad })}>
                {DIFICULTADES.map((d) => (
                  <option key={d.value} value={d.value}>
                    {d.nombre}
                  </option>
                ))}
              </NativeSelect>
            )}
          </FormField>
          <FormField id={`${px}-valorPuntos`} label="Valor (puntos)" error={errors.valorPuntos}>
            {(a11y) => (
              <Input
                {...a11y}
                type="number"
                min={0.25}
                step={0.25}
                value={draft.valorPuntos}
                onChange={(e) => set({ valorPuntos: Number(e.target.value) })}
              />
            )}
          </FormField>
          <FormField id={`${px}-fuente`} label="Fuente" optional className="sm:col-span-2" hint={`Vacía: «${FUENTE_PROPIA}».`}>
            {(a11y) => (
              <Input {...a11y} value={draft.fuente} onChange={(e) => set({ fuente: e.target.value })} placeholder={FUENTE_PROPIA} />
            )}
          </FormField>
          <FormField
            id={`${px}-fuenteDetallada`}
            label="Fuente detallada"
            optional
            className="sm:col-span-2 lg:col-span-4"
            hint={`Vacía: «${fuenteDetalladaDe(autor)}». Si viene de una guía: pregunta, página y tema.`}
          >
            {(a11y) => (
              <Input
                {...a11y}
                value={draft.fuenteDetallada}
                onChange={(e) => set({ fuenteDetallada: e.target.value })}
                placeholder={fuenteDetalladaDe(autor)}
              />
            )}
          </FormField>
        </div>
      </Section>

      {/* Asignación */}
      <Section title="Carreras" description="Relación muchos a muchos: la misma pregunta puede servir a varias carreras. Marcar un área marca todas sus carreras.">
        {catalogo ? (
          <CarrerasSelector
            id={`${px}-destinos`}
            catalogo={catalogo}
            institucion={draft.institucion || null}
            value={draft.destinos}
            onChange={(destinos) => set({ destinos })}
            invalid={Boolean(errors.destinos)}
          />
        ) : (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Cargando escuelas y carreras…
          </p>
        )}
        {errors.destinos && <p className="text-sm text-destructive">{errors.destinos}</p>}
      </Section>

      {/* Reactivo */}
      <Section title="Reactivo" description="Fórmulas en LaTeX entre (form) y (/form), ej. (form)\frac{9}{3}(/form).">
        {draft.lecturaAsociada === null ? (
          <Button type="button" variant="outline" size="sm" className="w-fit" onClick={() => set({ lecturaAsociada: "" })}>
            <Plus /> Agregar lectura asociada
          </Button>
        ) : (
          <FormulaField
            id={`${px}-lecturaAsociada`}
            label="Lectura asociada"
            value={draft.lecturaAsociada}
            onChange={(lecturaAsociada) => set({ lecturaAsociada })}
            error={errors.lecturaAsociada}
            rows={6}
            placeholder="Texto o pasaje previo (comprensión lectora, TOEFL, caso clínico)…"
            onRemove={() => set({ lecturaAsociada: null })}
          />
        )}
        <FormulaField
          id={`${px}-pregunta`}
          label="Pregunta"
          value={draft.pregunta}
          onChange={(pregunta) => set({ pregunta })}
          error={errors.pregunta}
          rows={3}
          placeholder="Resuelve el sistema. (form)3x+5y=13(/form) (form)2x-y=11(/form)"
        />
      </Section>

      {/* Respuestas */}
      <Section
        title="Respuestas ponderadas"
        description="Exactamente una con 1.0; las parciales valen 0.75, 0.5 o 0.25. Al estudiante se le muestran en orden aleatorio."
      >
        {errors.respuestas && (
          <p id={`${px}-respuestas`} tabIndex={-1} className="text-sm text-destructive">
            {errors.respuestas}
          </p>
        )}
        <div className="grid gap-4 lg:grid-cols-2">
          {draft.respuestas.map((r, i) => (
            <fieldset key={i} className="flex flex-col gap-3 rounded-xl border bg-background/40 p-4">
              <legend className="sr-only">Opción {i + 1}</legend>
              <div className="flex items-center gap-2">
                <span className={cn("grid size-7 place-items-center rounded-md border font-mono text-xs font-bold", scoreTone(r.ponderacion))}>{r.id}</span>
                <div className="w-36">
                  <NativeSelect
                    id={`${px}-respuestas-${i}-ponderacion`}
                    aria-label={`Ponderación de la opción ${r.id}`}
                    aria-invalid={Boolean(errors[`respuestas.${i}.ponderacion`])}
                    value={r.ponderacion}
                    onChange={(e) => setRespuesta(i, { ponderacion: Number(e.target.value) as Ponderacion })}
                    className="h-9"
                  >
                    {PONDERACIONES.map((p) => (
                      <option key={p} value={p}>
                        {formatScore(p)} · {p === 1 ? "Correcta" : p > 0 ? "Parcial" : "Error"}
                      </option>
                    ))}
                  </NativeSelect>
                </div>
                {draft.respuestas.length > 2 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="ml-auto size-9"
                    onClick={() => set({ respuestas: draft.respuestas.filter((_, j) => j !== i) })}
                    aria-label={`Quitar opción ${r.id}`}
                  >
                    <X />
                  </Button>
                )}
              </div>
              <FormField id={`${px}-respuestas-${i}-texto`} label="Texto" error={errors[`respuestas.${i}.texto`]}>
                {(a11y) => <Input {...a11y} value={r.texto} onChange={(e) => setRespuesta(i, { texto: e.target.value })} />}
              </FormField>
              {r.texto.includes(FORM_OPEN) && <MathText text={r.texto} className="block rounded-md bg-card px-3 py-2 text-sm" />}
              {r.ponderacion < 1 && (
                <FormField id={`${px}-respuestas-${i}-diagnosticoError`} label="Diagnóstico del error" error={errors[`respuestas.${i}.diagnosticoError`]}>
                  {(a11y) => (
                    <Textarea
                      {...a11y}
                      rows={2}
                      value={r.diagnosticoError ?? ""}
                      onChange={(e) => setRespuesta(i, { diagnosticoError: e.target.value })}
                      placeholder="Ej. Cometiste un error de signo al despejar x…"
                    />
                  )}
                </FormField>
              )}
            </fieldset>
          ))}
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-fit"
          onClick={() => set({ respuestas: [...draft.respuestas, emptyRespuesta(Math.max(-1, ...draft.respuestas.map((r) => r.id)) + 1)] })}
        >
          <Plus /> Agregar opción
        </Button>
      </Section>

      {/* Solución */}
      <Section title="Solución paso a paso">
        <ol className="flex flex-col gap-3">
          {draft.solucionPasoAPaso.map((paso, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className="mt-3 w-6 shrink-0 font-mono text-xs text-muted-foreground">{i + 1}.</span>
              <div className="min-w-0 flex-1">
                <FormulaField
                  id={`${px}-solucionPasoAPaso-${i}`}
                  label={`Paso ${i + 1}`}
                  hideLabel
                  value={paso}
                  onChange={(v) => setPaso(i, v)}
                  error={errors[`solucionPasoAPaso.${i}`]}
                  rows={2}
                  onRemove={draft.solucionPasoAPaso.length > 1 ? () => set({ solucionPasoAPaso: draft.solucionPasoAPaso.filter((_, j) => j !== i) }) : undefined}
                />
              </div>
            </li>
          ))}
        </ol>
        <Button type="button" variant="outline" size="sm" className="w-fit" onClick={() => set({ solucionPasoAPaso: [...draft.solucionPasoAPaso, ""] })}>
          <Plus /> Agregar paso
        </Button>
      </Section>

      {avisos.length > 0 && (
        <ul className="flex flex-col gap-1 rounded-2xl border border-gold/40 bg-gold/5 p-4 text-sm">
          {avisos.map((a, n) => (
            <li key={n} className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-gold" />
              <span>
                <span className="font-mono text-xs text-muted-foreground">{fieldLabel(a.field)}</span> {a.message}
              </span>
            </li>
          ))}
        </ul>
      )}

      <div
        className={cn(
          "sticky bottom-0 z-10 flex flex-col-reverse gap-2 border-t bg-background/90 py-3 backdrop-blur sm:flex-row sm:items-center",
          // La ventana tiene padding: el pie se pega a su borde real (-bottom-6) para que nada asome debajo.
          inDialog ? "-bottom-6 -mx-6 -mb-6 bg-card px-6 pb-6" : "-mx-4 px-4 sm:mx-0 sm:rounded-2xl sm:border"
        )}
      >
        {savedId && (
          <p className="flex items-center gap-1.5 text-sm text-secondary sm:mr-auto" role="status">
            <CheckCircle2 className="size-4" /> {savedId} guardada en el banco{isNew ? "; captura la siguiente" : ""}.
          </p>
        )}
        {saveError && (
          <p className="flex items-center gap-1.5 text-sm text-destructive sm:mr-auto" role="alert">
            <AlertTriangle className="size-4 shrink-0" /> {saveError}
          </p>
        )}
        <div className="flex flex-col-reverse gap-2 sm:ml-auto sm:flex-row">
          <Button type="button" variant="outline" onClick={preview}>
            <Eye /> Vista previa
          </Button>
          <Button type="submit" disabled={saving || !catalogo}>
            {saving ? <Loader2 className="animate-spin" /> : <Save />} {isNew ? "Guardar pregunta" : "Guardar cambios"}
          </Button>
        </div>
      </div>
    </form>
  );
}

function firstByField(issues: Issue[]) {
  const map: Record<string, string> = {};
  for (const i of issues) map[i.field] ??= i.message;
  return map;
}

/** Área de texto con botón para envolver la selección en (form)…(/form) y vista previa con KaTeX. */
function FormulaField({
  id,
  label,
  hideLabel,
  value,
  onChange,
  error,
  rows,
  placeholder,
  onRemove,
}: {
  id: string;
  label: string;
  hideLabel?: boolean;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  rows: number;
  placeholder?: string;
  onRemove?: () => void;
}) {
  const ref = React.useRef<HTMLTextAreaElement>(null);

  const wrap = () => {
    const el = ref.current;
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? value.length;
    const inner = value.slice(start, end);
    onChange(value.slice(0, start) + FORM_OPEN + inner + FORM_CLOSE + value.slice(end));
    requestAnimationFrame(() => {
      el?.focus();
      const cursor = start + FORM_OPEN.length + inner.length;
      el?.setSelectionRange(cursor, cursor);
    });
  };

  return (
    <FormField id={id} label={hideLabel ? <span className="sr-only">{label}</span> : label} error={error}>
      {(a11y) => (
        <div className="flex flex-col gap-2">
          <div className="flex items-start gap-2">
            <Textarea {...a11y} ref={ref} rows={rows} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
            <div className="flex shrink-0 flex-col gap-1">
              <Button type="button" variant="ghost" size="icon" className="size-9" onClick={wrap} aria-label={`Insertar fórmula en ${label}`} title="Insertar (form)…(/form)">
                <Sigma />
              </Button>
              {onRemove && (
                <Button type="button" variant="ghost" size="icon" className="size-9" onClick={onRemove} aria-label={`Quitar ${label}`}>
                  <X />
                </Button>
              )}
            </div>
          </div>
          {value.includes(FORM_OPEN) && (
            <div className="rounded-md border border-dashed bg-card px-3 py-2 text-sm">
              <MathText text={value} />
            </div>
          )}
        </div>
      )}
    </FormField>
  );
}

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4 rounded-2xl border bg-card p-4 sm:p-5">
      <header>
        <h3 className="font-semibold">{title}</h3>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </header>
      {children}
    </section>
  );
}
