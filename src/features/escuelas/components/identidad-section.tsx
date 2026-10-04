"use client";

import * as React from "react";
import { CircleAlert, ImageUp, Loader2, Palette, Pencil, Timer, Trash2, TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { FormField, invalidClass } from "@/features/registro/components/form-field";
import { SchoolIcon, useIdentidades } from "@/features/identidad";
import { contrastRatio, normalizeHex, textOn } from "@/features/identidad/lib/color";
import { svgProblem } from "@/features/identidad/lib/svg";
import { actualizarIdentidad, IdentidadError, subirLogo } from "@/features/identidad/services/identidad-service";
import type { IdentidadInput } from "@/features/identidad/types";
import { cn } from "@/lib/utils";

import type { Institucion } from "../types";

const FALLBACK = "#1a1a1a";

const draftOf = (inst: Institucion): IdentidadInput => ({
  sigla: inst.sigla,
  colorPrimario: inst.colorPrimario,
  colorSecundario: inst.colorSecundario,
  colorAcento: inst.colorAcento,
  iconoSvg: inst.iconoSvg,
  logoUrl: inst.logoUrl,
});

/** Colores resueltos (con los mismos respaldos que usa el theme engine). */
function palette(d: IdentidadInput) {
  const primary = normalizeHex(d.colorPrimario ?? "") ?? FALLBACK;
  const secondary = normalizeHex(d.colorSecundario ?? "") ?? primary;
  const accent = normalizeHex(d.colorAcento ?? "") ?? secondary;
  return { primary, secondary, accent, onPrimary: textOn(primary), onAccent: textOn(accent) };
}

/** Ficha › Identidad: cómo se ve la institución en el registro, los paneles y el examen. */
export function IdentidadSection({ institucion, onSaved }: { institucion: Institucion; onSaved: () => void }) {
  const [open, setOpen] = React.useState(false);
  const draft = draftOf(institucion);
  const p = palette(draft);

  return (
    <section aria-labelledby="identidad-title" className="flex flex-col gap-4 rounded-2xl border bg-card p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 id="identidad-title" className="flex items-center gap-2 font-semibold">
            <Palette className="size-4 text-gold" aria-hidden /> Identidad
          </h3>
          <p className="text-xs text-muted-foreground">Sigla, colores e ícono en el registro, los paneles y el examen.</p>
        </div>
        <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
          <Pencil /> Editar identidad
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
        <dl className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-2 text-sm">
          <dt className="text-muted-foreground">Sigla</dt>
          <dd className="font-semibold">{draft.sigla}</dd>
          {(
            [
              ["Primario", institucion.colorPrimario],
              ["Secundario", institucion.colorSecundario],
              ["Acento", institucion.colorAcento],
            ] as const
          ).map(([label, hex]) => (
            <React.Fragment key={label}>
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="flex items-center gap-2 font-mono text-xs">
                <span className="size-4 rounded ring-1 ring-white/20" style={{ background: hex ?? "transparent" }} aria-hidden />
                {hex ?? "Sin definir"}
              </dd>
            </React.Fragment>
          ))}
          <dt className="text-muted-foreground">Ícono</dt>
          <dd>{institucion.iconoSvg ? <SchoolIcon svgRaw={institucion.iconoSvg} color={p.primary} className="size-7" /> : "Genérico"}</dd>
          <dt className="text-muted-foreground">Logo</dt>
          <dd>
            {institucion.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- export estático: sin optimizador de imágenes
              <img src={institucion.logoUrl} alt={`Logo de ${institucion.nombre}`} className="h-8 w-auto rounded bg-white p-1" />
            ) : (
              <span className="text-muted-foreground">Sin logo</span>
            )}
          </dd>
        </dl>
        <IdentidadPreview draft={draft} nombre={institucion.nombre} />
      </div>

      <IdentidadDialog
        open={open}
        institucion={institucion}
        onClose={() => setOpen(false)}
        onSaved={() => {
          setOpen(false);
          onSaved();
        }}
      />
    </section>
  );
}

/** Vista previa con los colores del borrador: badge, ícono y encabezado de examen. */
function IdentidadPreview({ draft, nombre }: { draft: IdentidadInput; nombre: string }) {
  const p = palette(draft);
  return (
    <div className="flex flex-col gap-3 rounded-xl bg-[#f2f2f2] p-3 text-[#111111]" aria-label="Vista previa">
      <div className="flex items-center gap-3">
        <span
          className="inline-grid h-11 min-w-14 place-items-center rounded-xl px-2.5 font-display text-sm font-bold shadow-sm"
          style={{ background: p.primary, color: p.onPrimary }}
        >
          {draft.sigla || "—"}
        </span>
        <span className="grid size-11 place-items-center rounded-xl" style={{ background: p.primary }}>
          <SchoolIcon svgRaw={draft.iconoSvg} color={p.onPrimary} className="size-6" />
        </span>
        <span className="grid size-11 place-items-center rounded-xl bg-white ring-1 ring-black/10">
          <SchoolIcon svgRaw={draft.iconoSvg} color={`linear-gradient(135deg, ${p.primary}, ${p.secondary})`} className="size-6" />
        </span>
        <span className="min-w-0 truncate text-xs text-[#5c5c5c]">{nombre}</span>
      </div>

      <div className="overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-black/10">
        <div className="flex items-center justify-between gap-2 px-3 py-2 text-xs font-semibold" style={{ background: p.primary, color: p.onPrimary }}>
          <span className="flex min-w-0 items-center gap-2 truncate">
            <SchoolIcon svgRaw={draft.iconoSvg} color={p.onPrimary} className="size-4" />
            Simulador {draft.sigla || "—"}
          </span>
          <span className="flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5" style={{ background: p.accent, color: p.onAccent }}>
            <Timer className="size-3" aria-hidden /> 42:10
          </span>
        </div>
        <div className="h-1.5 bg-[#e8e8e8]">
          <div className="h-full w-2/5" style={{ background: `linear-gradient(90deg, ${p.primary}, ${p.secondary})` }} />
        </div>
        <div className="flex flex-col gap-2 p-3 text-xs">
          <p className="font-display text-sm font-semibold" style={{ color: p.primary }}>
            Pregunta 12 de 120
          </p>
          <span className="rounded-md border-2 px-2 py-1.5" style={{ borderColor: p.primary, background: `${p.primary}14` }}>
            B) Opción elegida
          </span>
          <span className="rounded-md border border-[#d2d2d2] px-2 py-1.5">C) Otra opción</span>
          <span className="self-end rounded-md px-3 py-1.5 font-semibold" style={{ background: p.primary, color: p.onPrimary }}>
            Siguiente
          </span>
        </div>
      </div>
    </div>
  );
}

function IdentidadDialog({
  open,
  institucion,
  onClose,
  onSaved,
}: {
  open: boolean;
  institucion: Institucion;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { refresh } = useIdentidades();
  const [draft, setDraft] = React.useState<IdentidadInput>(() => draftOf(institucion));
  const [saving, setSaving] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (!open) return;
    setDraft(draftOf(institucion));
    setError(null);
  }, [open, institucion]);

  const set = (patch: Partial<IdentidadInput>) => setDraft((d) => ({ ...d, ...patch }));
  const svgError = draft.iconoSvg ? svgProblem(draft.iconoSvg) : null;
  const p = palette(draft);
  const lowContrast = draft.colorPrimario && contrastRatio(p.primary, p.onPrimary) < 4.5;

  const upload = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      set({ logoUrl: await subirLogo(institucion.id, file) });
    } catch (e) {
      setError(e instanceof IdentidadError ? e.message : "No se pudo subir el logo.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await actualizarIdentidad(institucion.id, draft);
      await refresh();
      onSaved();
    } catch (err) {
      setError(err instanceof IdentidadError ? err.message : "No se pudo guardar. Intenta de nuevo.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !saving && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Identidad de {institucion.clave}</DialogTitle>
          <DialogDescription>Los cambios se ven en toda la plataforma al guardar.</DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
          <IdentidadPreview draft={draft} nombre={institucion.nombre} />

          <FormField
            id="id-sigla"
            label="Sigla"
            hint={`Lo que ven los usuarios (ej. CU). La clave ${institucion.clave} de los reactivos no cambia.`}
          >
            {(a11y) => (
              <Input {...a11y} value={draft.sigla} maxLength={12} onChange={(e) => set({ sigla: e.target.value })} className={invalidClass} />
            )}
          </FormField>

          <div className="grid gap-4 sm:grid-cols-3">
            <ColorField id="id-primario" label="Primario" value={draft.colorPrimario} onChange={(v) => set({ colorPrimario: v })} />
            <ColorField id="id-secundario" label="Secundario" value={draft.colorSecundario} onChange={(v) => set({ colorSecundario: v })} />
            <ColorField id="id-acento" label="Acento" value={draft.colorAcento} onChange={(v) => set({ colorAcento: v })} />
          </div>
          {lowContrast && (
            <p className="flex items-start gap-2 text-sm text-gold">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
              El primario tiene poco contraste con el texto ({contrastRatio(p.primary, p.onPrimary).toFixed(1)}:1). Usa un tono más
              oscuro o más claro para que se lea bien.
            </p>
          )}

          <FormField
            id="id-svg"
            label="Ícono (SVG lineal en blanco)"
            optional
            error={svgError ?? undefined}
            hint="Pega el código completo, de <svg …> a </svg>. Se pinta con los colores de la institución."
          >
            {(a11y) => (
              <textarea
                {...a11y}
                value={draft.iconoSvg ?? ""}
                onChange={(e) => set({ iconoSvg: e.target.value || null })}
                rows={4}
                spellCheck={false}
                placeholder='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" …>…</svg>'
                className={cn(
                  "border-input w-full rounded-md border bg-background/60 px-3 py-2 font-mono text-xs text-foreground outline-none",
                  "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40",
                  invalidClass
                )}
              />
            )}
          </FormField>

          <div className="flex flex-col gap-2">
            <span className="flex items-baseline justify-between text-sm font-medium text-cool">
              Logo oficial <span className="text-xs font-normal text-muted-foreground">Opcional</span>
            </span>
            <div className="flex flex-wrap items-center gap-3">
              {draft.logoUrl && (
                // eslint-disable-next-line @next/next/no-img-element -- export estático: sin optimizador de imágenes
                <img src={draft.logoUrl} alt="Logo actual" className="h-12 w-auto rounded bg-white p-1" />
              )}
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/webp,image/svg+xml"
                className="sr-only"
                id="id-logo"
                onChange={(e) => upload(e.target.files?.[0])}
              />
              <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
                {uploading ? <Loader2 className="animate-spin" /> : <ImageUp />} {draft.logoUrl ? "Cambiar logo" : "Subir logo"}
              </Button>
              {draft.logoUrl && (
                <Button type="button" variant="ghost" size="sm" onClick={() => set({ logoUrl: null })}>
                  <Trash2 /> Quitar
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              PNG, WebP o SVG de hasta 1 MB. Los logos son marcas registradas: súbelo solo con autorización de la institución.
            </p>
          </div>

          {error && (
            <p role="alert" className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
              {error}
            </p>
          )}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving || uploading || Boolean(svgError)}>
              {saving && <Loader2 className="animate-spin" />} Guardar
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Selector de color + HEX escrito a mano (ej. pegado del manual de identidad). */
function ColorField({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string | null;
  onChange: (value: string | null) => void;
}) {
  const [text, setText] = React.useState(value ?? "");
  React.useEffect(() => setText(value ?? ""), [value]);
  const valid = !text.trim() || normalizeHex(text) !== null;

  return (
    <FormField id={id} label={label} error={valid ? undefined : "HEX no válido"}>
      {(a11y) => (
        <div className="flex gap-2">
          <input
            type="color"
            aria-label={`${label}: elegir color`}
            value={normalizeHex(text) ?? "#000000"}
            onChange={(e) => {
              setText(e.target.value);
              onChange(e.target.value);
            }}
            className="h-11 w-12 shrink-0 cursor-pointer rounded-md border border-input bg-transparent p-1"
          />
          <Input
            {...a11y}
            value={text}
            placeholder="#002B7A"
            maxLength={7}
            onChange={(e) => {
              setText(e.target.value);
              const hex = normalizeHex(e.target.value);
              if (hex || !e.target.value.trim()) onChange(hex);
            }}
            className={cn("font-mono uppercase", invalidClass)}
          />
        </div>
      )}
    </FormField>
  );
}
