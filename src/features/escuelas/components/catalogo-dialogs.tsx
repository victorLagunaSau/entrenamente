"use client";

import * as React from "react";
import { ChevronDown, CircleAlert, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { FormField, invalidClass } from "@/features/registro/components/form-field";
import { cn } from "@/lib/utils";

import { TIPOS, byOrden, carreraLabel } from "../lib/catalogo";
import {
  CatalogoError,
  actualizarArea,
  actualizarCarrera,
  actualizarInstitucion,
  crearArea,
  crearCarrera,
  crearInstitucion,
} from "../services/catalogo-service";
import type { Area, Carrera, Institucion, TipoInstitucion } from "../types";

export function NativeSelect({ className, children, ...props }: React.ComponentProps<"select">) {
  return (
    <div className="relative">
      <select
        className={cn(
          "border-input h-11 w-full min-w-0 appearance-none rounded-md border bg-background/60 pr-9 pl-3 text-base text-foreground outline-none md:text-sm",
          "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40",
          invalidClass,
          className
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground" />
    </div>
  );
}

/** Guarda con `save`; si lanza CatalogoError muestra el mensaje y deja el diálogo abierto. */
function useSave(onDone: () => void) {
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const run = async (save: () => Promise<unknown>) => {
    setSaving(true);
    setError(null);
    try {
      await save();
      onDone();
    } catch (e) {
      setError(e instanceof CatalogoError ? e.message : "No se pudo guardar. Intenta de nuevo.");
    } finally {
      setSaving(false);
    }
  };

  return { saving, error, run };
}

function FormError({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <p role="alert" className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
      <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
      {error}
    </p>
  );
}

function FormActions({ saving, onCancel, label }: { saving: boolean; onCancel: () => void; label: string }) {
  return (
    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
      <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
        Cancelar
      </Button>
      <Button type="submit" disabled={saving}>
        {saving && <Loader2 className="animate-spin" />} {label}
      </Button>
    </div>
  );
}

/* ─────────────────────────── Institución ─────────────────────────── */

export function InstitucionDialog({
  open,
  institucion,
  catalogo,
  onClose,
  onSaved,
}: {
  open: boolean;
  institucion: Institucion | null;
  catalogo: Institucion[];
  onClose: () => void;
  onSaved: (id: string) => void;
}) {
  const [clave, setClave] = React.useState("");
  const [nombre, setNombre] = React.useState("");
  const [tipo, setTipo] = React.useState<TipoInstitucion>("universidad");
  const [examen, setExamen] = React.useState("");
  const savedId = React.useRef<string | null>(null);
  const { saving, error, run } = useSave(() => onSaved(savedId.current ?? institucion?.id ?? ""));

  React.useEffect(() => {
    if (!open) return;
    setClave(institucion?.clave ?? "");
    setNombre(institucion?.nombre ?? "");
    setTipo(institucion?.tipo ?? "universidad");
    setExamen(institucion?.examen ?? "");
  }, [open, institucion]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const input = { clave, nombre, tipo, examen: examen || null };
    run(async () => {
      savedId.current = institucion
        ? (await actualizarInstitucion(institucion.id, input, catalogo), institucion.id)
        : await crearInstitucion(input, catalogo);
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !saving && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{institucion ? "Editar institución" : "Nueva institución"}</DialogTitle>
          <DialogDescription>Universidad o examen especial (TOEFL, EXANI…).</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
          <FormField id="inst-tipo" label="Tipo">
            {(a11y) => (
              <NativeSelect {...a11y} value={tipo} onChange={(e) => setTipo(e.target.value as TipoInstitucion)}>
                {TIPOS.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.nombre}
                  </option>
                ))}
              </NativeSelect>
            )}
          </FormField>
          <FormField
            id="inst-clave"
            label="Clave"
            hint={
              institucion
                ? "Prefijo de los IDs de reactivos. Cámbiala solo si aún no hay preguntas con la clave anterior."
                : "Prefijo de los IDs de reactivos (ej. UNAM, TEC, TOEFL)."
            }
          >
            {(a11y) => (
              <Input
                {...a11y}
                value={clave}
                onChange={(e) => setClave(e.target.value.toUpperCase().replace(/\s/g, ""))}
                maxLength={12}
                autoComplete="off"
                className={cn("font-mono uppercase", invalidClass)}
                required
              />
            )}
          </FormField>
          <FormField id="inst-nombre" label="Nombre">
            {(a11y) => <Input {...a11y} value={nombre} onChange={(e) => setNombre(e.target.value)} required />}
          </FormField>
          {tipo === "universidad" && (
            <FormField id="inst-examen" label="Examen de admisión" optional hint="Solo si no es el genérico (ej. PAA en el TEC).">
              {(a11y) => <Input {...a11y} value={examen} onChange={(e) => setExamen(e.target.value)} />}
            </FormField>
          )}
          <FormError error={error} />
          <FormActions saving={saving} onCancel={onClose} label={institucion ? "Guardar" : "Agregar"} />
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ─────────────────────────── Área ─────────────────────────── */

export function AreaDialog({
  open,
  institucion,
  area,
  catalogo,
  onClose,
  onSaved,
}: {
  open: boolean;
  institucion: Institucion;
  area: Area | null;
  catalogo: Institucion[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [codigo, setCodigo] = React.useState("");
  const [nombre, setNombre] = React.useState("");
  const { saving, error, run } = useSave(onSaved);

  React.useEffect(() => {
    if (!open) return;
    setCodigo(area?.codigo ?? `A${institucion.areas.length + 1}`);
    setNombre(area?.nombre ?? "");
  }, [open, area, institucion]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    run(() =>
      area ? actualizarArea(institucion, area.id, { codigo, nombre }) : crearArea(institucion, { codigo, nombre }, catalogo)
    );
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !saving && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{area ? "Editar área" : "Nueva área"}</DialogTitle>
          <DialogDescription>
            {institucion.clave} · Las guías de estudio se hacen por área y sirven a todas sus carreras.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
          <FormField id="area-codigo" label="Código" hint="Segundo bloque del ID de reactivo (ej. A1).">
            {(a11y) => (
              <Input
                {...a11y}
                value={codigo}
                onChange={(e) => setCodigo(e.target.value.toUpperCase().replace(/\s/g, ""))}
                maxLength={12}
                autoComplete="off"
                className={cn("font-mono uppercase", invalidClass)}
                required
              />
            )}
          </FormField>
          <FormField id="area-nombre" label="Nombre">
            {(a11y) => <Input {...a11y} value={nombre} onChange={(e) => setNombre(e.target.value)} required />}
          </FormField>
          <FormError error={error} />
          <FormActions saving={saving} onCancel={onClose} label={area ? "Guardar" : "Agregar"} />
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ─────────────────────────── Carrera ─────────────────────────── */

export function CarreraDialog({
  open,
  institucion,
  carrera,
  defaultAreaId,
  catalogo,
  onClose,
  onSaved,
}: {
  open: boolean;
  institucion: Institucion;
  carrera: Carrera | null;
  defaultAreaId?: string | null;
  catalogo: Institucion[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [nombre, setNombre] = React.useState("");
  const [areaId, setAreaId] = React.useState("");
  const { saving, error, run } = useSave(onSaved);
  const label = carreraLabel(institucion.tipo);
  const areas = [...institucion.areas].sort(byOrden);

  React.useEffect(() => {
    if (!open) return;
    setNombre(carrera?.nombre ?? "");
    setAreaId(carrera ? (carrera.areaId ?? "") : (defaultAreaId ?? ""));
  }, [open, carrera, defaultAreaId]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const input = { nombre, areaId: areaId || null };
    run(() => (carrera ? actualizarCarrera(institucion, carrera.id, input) : crearCarrera(institucion, input, catalogo)));
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !saving && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{carrera ? `Editar ${label.toLowerCase()}` : `Nueva ${label.toLowerCase()}`}</DialogTitle>
          <DialogDescription>
            {institucion.clave} · {institucion.nombre}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
          <FormField
            id="carrera-nombre"
            label="Nombre"
            hint={institucion.tipo === "examen_especial" ? "Edición del examen (ej. TOEFL 2026)." : undefined}
          >
            {(a11y) => <Input {...a11y} value={nombre} onChange={(e) => setNombre(e.target.value)} required />}
          </FormField>
          <FormField
            id="carrera-area"
            label="Área"
            optional
            hint={areas.length ? undefined : "Esta institución no tiene áreas; agrégalas desde la sección Áreas."}
          >
            {(a11y) => (
              <NativeSelect {...a11y} value={areaId} onChange={(e) => setAreaId(e.target.value)} disabled={!areas.length}>
                <option value="">Sin área</option>
                {areas.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.codigo} · {a.nombre}
                    {a.activo ? "" : " (inactiva)"}
                  </option>
                ))}
              </NativeSelect>
            )}
          </FormField>
          {carrera && (
            <p className="text-xs text-muted-foreground">
              ID: <code className="font-mono">{carrera.id}</code> (no cambia aunque edites el nombre).
            </p>
          )}
          <FormError error={error} />
          <FormActions saving={saving} onCancel={onClose} label={carrera ? "Guardar" : "Agregar"} />
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ─────────────────────────── Confirmación ─────────────────────────── */

export type ConfirmRequest = { title: string; description: string; confirmLabel: string; action: () => Promise<void> };

export function ConfirmDialog({ request, onClose, onDone }: { request: ConfirmRequest | null; onClose: () => void; onDone: () => void }) {
  const { saving, error, run } = useSave(onDone);

  return (
    <Dialog open={Boolean(request)} onOpenChange={(o) => !o && !saving && onClose()}>
      <DialogContent role="alertdialog">
        <DialogHeader>
          <DialogTitle>{request?.title}</DialogTitle>
          <DialogDescription>{request?.description}</DialogDescription>
        </DialogHeader>
        <FormError error={error} />
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button
            className="bg-destructive text-white hover:bg-destructive/90"
            onClick={() => request && run(request.action)}
            disabled={saving}
          >
            {saving && <Loader2 className="animate-spin" />} {request?.confirmLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
