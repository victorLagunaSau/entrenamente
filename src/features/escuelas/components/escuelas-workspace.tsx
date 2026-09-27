"use client";

import * as React from "react";
import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Eye,
  EyeOff,
  Loader2,
  Pencil,
  Plus,
  Power,
  RotateCcw,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { AdminPageHeader } from "@/features/admin/components/admin-module";
import { cn } from "@/lib/utils";

import { carreraLabel, carrerasLabel, carrerasPorArea, tipoNombre } from "../lib/catalogo";
import {
  getCatalogo,
  intercambiarOrdenAreas,
  setAreaActiva,
  setCarreraActiva,
  setInstitucionActiva,
} from "../services/catalogo-service";
import type { Area, Carrera, Institucion } from "../types";
import { AreaDialog, CarreraDialog, ConfirmDialog, InstitucionDialog, type ConfirmRequest } from "./catalogo-dialogs";

type DialogState =
  | { kind: "institucion"; institucion: Institucion | null }
  | { kind: "area"; area: Area | null }
  | { kind: "carrera"; carrera: Carrera | null; areaId?: string | null }
  | null;

/** Alta y edición del catálogo instituciones › áreas › carreras. Nada se borra: se desactiva. */
export function EscuelasWorkspace() {
  const [catalogo, setCatalogo] = React.useState<Institucion[] | null>(null);
  const [loadError, setLoadError] = React.useState(false);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [dialog, setDialog] = React.useState<DialogState>(null);
  const [confirm, setConfirm] = React.useState<ConfirmRequest | null>(null);
  const [confirmKey, setConfirmKey] = React.useState(0);

  const load = React.useCallback(async () => {
    try {
      setCatalogo(await getCatalogo({ incluirInactivos: true }));
      setLoadError(false);
    } catch {
      setLoadError(true);
    }
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  const selected = catalogo?.find((i) => i.id === selectedId) ?? null;

  const askConfirm = (req: ConfirmRequest) => {
    setConfirmKey((k) => k + 1);
    setConfirm(req);
  };

  const closeDialog = () => setDialog(null);
  const saved = async () => {
    setDialog(null);
    await load();
  };

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader
        eyebrow="/admin/escuelas"
        title="Escuelas, exámenes y carreras"
        description="Universidades y exámenes especiales con sus áreas y carreras. Lo que desactives deja de verse en el registro, pero no se borra."
      />

      {loadError ? (
        <div role="alert" className="flex flex-col items-start gap-3 rounded-2xl border border-destructive/40 bg-destructive/10 p-5 text-sm">
          <p className="flex items-center gap-2 text-destructive">
            <CircleAlert className="size-4" /> No se pudo cargar el catálogo. ¿Ya corriste la migración en Supabase?
          </p>
          <Button variant="outline" size="sm" onClick={load}>
            <RotateCcw /> Reintentar
          </Button>
        </div>
      ) : !catalogo ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
          <Loader2 className="size-4 animate-spin" /> Cargando catálogo…
        </p>
      ) : selected ? (
        <InstitucionDetail
          institucion={selected}
          onBack={() => setSelectedId(null)}
          onDialog={setDialog}
          onConfirm={askConfirm}
          onChanged={load}
        />
      ) : (
        <InstitucionesList
          catalogo={catalogo}
          onOpen={setSelectedId}
          onNew={() => setDialog({ kind: "institucion", institucion: null })}
        />
      )}

      {catalogo && (
        <InstitucionDialog
          open={dialog?.kind === "institucion"}
          institucion={dialog?.kind === "institucion" ? dialog.institucion : null}
          catalogo={catalogo}
          onClose={closeDialog}
          onSaved={async (id) => {
            await saved();
            setSelectedId(id);
          }}
        />
      )}
      {catalogo && selected && (
        <>
          <AreaDialog
            open={dialog?.kind === "area"}
            institucion={selected}
            area={dialog?.kind === "area" ? dialog.area : null}
            catalogo={catalogo}
            onClose={closeDialog}
            onSaved={saved}
          />
          <CarreraDialog
            open={dialog?.kind === "carrera"}
            institucion={selected}
            carrera={dialog?.kind === "carrera" ? dialog.carrera : null}
            defaultAreaId={dialog?.kind === "carrera" ? dialog.areaId : null}
            catalogo={catalogo}
            onClose={closeDialog}
            onSaved={saved}
          />
        </>
      )}
      <ConfirmDialog
        key={confirmKey}
        request={confirm}
        onClose={() => setConfirm(null)}
        onDone={async () => {
          setConfirm(null);
          await load();
        }}
      />
    </div>
  );
}

/* ─────────────────────────── Piezas ─────────────────────────── */

function ColorDot({ colorId }: { colorId: string | null }) {
  return (
    <span
      aria-hidden
      className="size-2.5 shrink-0 rounded-full ring-1 ring-white/20"
      style={{ backgroundColor: colorId ? `var(--uni-${colorId})` : "var(--muted-foreground)" }}
    />
  );
}

function InactiveBadge({ label = "Inactiva" }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">
      <EyeOff className="size-3" aria-hidden /> {label}
    </span>
  );
}

function IconAction({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <Button variant="ghost" size="icon" className="size-9" onClick={onClick} disabled={disabled} aria-label={label} title={label}>
      {children}
    </Button>
  );
}

/* ─────────────────────────── Lista de instituciones ─────────────────────────── */

function InstitucionesList({
  catalogo,
  onOpen,
  onNew,
}: {
  catalogo: Institucion[];
  onOpen: (id: string) => void;
  onNew: () => void;
}) {
  const [verInactivas, setVerInactivas] = React.useState(true);
  const visibles = verInactivas ? catalogo : catalogo.filter((i) => i.activo);
  const inactivas = catalogo.length - catalogo.filter((i) => i.activo).length;

  return (
    <section aria-labelledby="inst-title" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="inst-title" className="text-lg font-semibold">
          Instituciones <span className="text-sm font-normal text-muted-foreground">({catalogo.length})</span>
        </h2>
        <div className="flex flex-wrap gap-2">
          {inactivas > 0 && (
            <Button variant="outline" size="sm" onClick={() => setVerInactivas((v) => !v)} aria-pressed={verInactivas}>
              {verInactivas ? <EyeOff /> : <Eye />} {verInactivas ? "Ocultar inactivas" : `Ver inactivas (${inactivas})`}
            </Button>
          )}
          <Button size="sm" onClick={onNew}>
            <Plus /> Nueva institución
          </Button>
        </div>
      </div>

      {visibles.length === 0 ? (
        <p className="rounded-2xl border bg-card p-6 text-center text-sm text-muted-foreground">Aún no hay instituciones.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {visibles.map((inst) => {
            const carrerasActivas = inst.carreras.filter((c) => c.activo).length;
            return (
              <li key={inst.id}>
                <button
                  type="button"
                  onClick={() => onOpen(inst.id)}
                  className={cn(
                    "group flex w-full items-center gap-3 rounded-2xl border bg-card p-4 text-left transition-colors",
                    "hover:border-brand-light/50 hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
                    !inst.activo && "opacity-70"
                  )}
                >
                  <ColorDot colorId={inst.colorId} />
                  <span className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <code className="font-mono text-sm font-semibold text-gold">{inst.clave}</code>
                      <span className="min-w-0 font-semibold text-pretty">{inst.nombre}</span>
                    </span>
                    <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span>{tipoNombre(inst.tipo)}</span>
                      <span>
                        {inst.areas.length} {inst.areas.length === 1 ? "área" : "áreas"}
                      </span>
                      <span>
                        {carrerasActivas} {carrerasActivas === 1 ? carreraLabel(inst.tipo).toLowerCase() : carrerasLabel(inst.tipo)}
                        {carrerasActivas !== inst.carreras.length && ` (+${inst.carreras.length - carrerasActivas} inactivas)`}
                      </span>
                      {!inst.activo && <InactiveBadge />}
                    </span>
                  </span>
                  <ChevronRight className="size-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/* ─────────────────────────── Detalle de una institución ─────────────────────────── */

function InstitucionDetail({
  institucion: inst,
  onBack,
  onDialog,
  onConfirm,
  onChanged,
}: {
  institucion: Institucion;
  onBack: () => void;
  onDialog: (d: DialogState) => void;
  onConfirm: (req: ConfirmRequest) => void;
  onChanged: () => Promise<void>;
}) {
  const headingRef = React.useRef<HTMLHeadingElement>(null);
  const [busy, setBusy] = React.useState(false);
  const [actionError, setActionError] = React.useState<string | null>(null);
  const label = carreraLabel(inst.tipo);
  const areas = inst.areas;
  const grupos = carrerasPorArea(inst);

  React.useEffect(() => {
    headingRef.current?.focus();
  }, [inst.id]);

  /** Acciones no destructivas (reactivar, reordenar): sin confirmación. */
  const quick = async (fn: () => Promise<void>) => {
    setBusy(true);
    setActionError(null);
    try {
      await fn();
      await onChanged();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "No se pudo guardar.");
    } finally {
      setBusy(false);
    }
  };

  const toggleInstitucion = () =>
    inst.activo
      ? onConfirm({
          title: `¿Desactivar ${inst.clave}?`,
          description:
            "Dejará de mostrarse en el registro junto con sus áreas y carreras. Los estudiantes que ya la tienen como meta la conservan. Puedes reactivarla cuando quieras.",
          confirmLabel: "Desactivar",
          action: () => setInstitucionActiva(inst.id, false),
        })
      : quick(() => setInstitucionActiva(inst.id, true));

  const toggleArea = (a: Area) =>
    a.activo
      ? onConfirm({
          title: `¿Desactivar el área ${a.codigo}?`,
          description: "Se oculta el área; sus carreras siguen activas y conservan la asignación. Puedes reactivarla cuando quieras.",
          confirmLabel: "Desactivar",
          action: () => setAreaActiva(a.id, false),
        })
      : quick(() => setAreaActiva(a.id, true));

  const toggleCarrera = (c: Carrera) =>
    c.activo
      ? onConfirm({
          title: `¿Desactivar “${c.nombre}”?`,
          description:
            "Dejará de mostrarse en el registro. Los estudiantes que ya la tienen como meta la conservan. Puedes reactivarla cuando quieras.",
          confirmLabel: "Desactivar",
          action: () => setCarreraActiva(c.id, false),
        })
      : quick(() => setCarreraActiva(c.id, true));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex w-fit items-center gap-1 rounded-md text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <ChevronLeft className="size-4" /> Instituciones
        </button>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-1">
            <h2 ref={headingRef} tabIndex={-1} className="flex flex-wrap items-center gap-2 text-xl font-semibold outline-none">
              <ColorDot colorId={inst.colorId} />
              <code className="font-mono text-gold">{inst.clave}</code>
              <span className="min-w-0 text-pretty">{inst.nombre}</span>
            </h2>
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
              <span>{tipoNombre(inst.tipo)}</span>
              {inst.examen && <span>Examen: {inst.examen}</span>}
              <span>
                ID: <code className="font-mono">{inst.id}</code>
              </span>
              {!inst.activo && <InactiveBadge />}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => onDialog({ kind: "institucion", institucion: inst })}>
              <Pencil /> Editar
            </Button>
            <Button variant="outline" size="sm" onClick={toggleInstitucion} disabled={busy}>
              {inst.activo ? <Power /> : <RotateCcw />} {inst.activo ? "Desactivar" : "Reactivar"}
            </Button>
          </div>
        </div>
      </div>

      {actionError && (
        <p role="alert" className="flex items-center gap-2 text-sm text-destructive">
          <CircleAlert className="size-4" /> {actionError}
        </p>
      )}

      {/* Áreas */}
      <section aria-labelledby="areas-title" className="flex flex-col gap-3 rounded-2xl border bg-card p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 id="areas-title" className="font-semibold">
              Áreas
            </h3>
            <p className="text-xs text-muted-foreground">Opcionales. Agrupan carreras que comparten guía de estudio.</p>
          </div>
          <Button size="sm" variant="outline" onClick={() => onDialog({ kind: "area", area: null })}>
            <Plus /> Nueva área
          </Button>
        </div>
        {areas.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin áreas: las {carrerasLabel(inst.tipo)} van directo a la institución.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {areas.map((a, i) => {
              const n = inst.carreras.filter((c) => c.areaId === a.id).length;
              return (
                <li key={a.id} className={cn("flex flex-wrap items-center gap-x-3 gap-y-1 py-2", !a.activo && "opacity-70")}>
                  <code className="w-10 shrink-0 font-mono text-sm font-semibold text-gold">{a.codigo}</code>
                  <span className="min-w-0 flex-1 basis-40 text-sm">
                    {a.nombre}{" "}
                    <span className="text-xs text-muted-foreground">
                      · {n} {n === 1 ? label.toLowerCase() : carrerasLabel(inst.tipo)}
                    </span>
                    {!a.activo && (
                      <>
                        {" "}
                        <InactiveBadge />
                      </>
                    )}
                  </span>
                  <span className="ml-auto flex items-center">
                    <IconAction label={`Subir ${a.codigo}`} disabled={busy || i === 0} onClick={() => quick(() => intercambiarOrdenAreas(a, areas[i - 1]))}>
                      <ArrowUp />
                    </IconAction>
                    <IconAction
                      label={`Bajar ${a.codigo}`}
                      disabled={busy || i === areas.length - 1}
                      onClick={() => quick(() => intercambiarOrdenAreas(a, areas[i + 1]))}
                    >
                      <ArrowDown />
                    </IconAction>
                    <IconAction label={`Editar ${a.codigo}`} onClick={() => onDialog({ kind: "area", area: a })}>
                      <Pencil />
                    </IconAction>
                    <IconAction label={a.activo ? `Desactivar ${a.codigo}` : `Reactivar ${a.codigo}`} disabled={busy} onClick={() => toggleArea(a)}>
                      {a.activo ? <Power /> : <RotateCcw />}
                    </IconAction>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Carreras */}
      <section aria-labelledby="carreras-title" className="flex flex-col gap-3 rounded-2xl border bg-card p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 id="carreras-title" className="font-semibold">
            {inst.tipo === "examen_especial" ? "Ediciones" : "Carreras"}{" "}
            <span className="text-sm font-normal text-muted-foreground">({inst.carreras.length})</span>
          </h3>
          <Button size="sm" onClick={() => onDialog({ kind: "carrera", carrera: null })}>
            <Plus /> Nueva {label.toLowerCase()}
          </Button>
        </div>

        {inst.carreras.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aún no hay {carrerasLabel(inst.tipo)}.</p>
        ) : (
          <div className="flex flex-col gap-4">
            {grupos.map(({ area, carreras }) => (
              <div key={area?.id ?? "sin-area"} className="flex flex-col gap-1">
                <div className="flex items-center justify-between gap-2 border-b pb-1">
                  <h4 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                    {area ? `${area.codigo} · ${area.nombre}` : "Sin área"}
                  </h4>
                  {area && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() => onDialog({ kind: "carrera", carrera: null, areaId: area.id })}
                      aria-label={`Agregar ${label.toLowerCase()} al área ${area.codigo}`}
                    >
                      <Plus /> Agregar
                    </Button>
                  )}
                </div>
                {carreras.length === 0 ? (
                  <p className="py-2 text-sm text-muted-foreground">Sin {carrerasLabel(inst.tipo)} en esta área.</p>
                ) : (
                  <ul className="flex flex-col divide-y divide-border">
                    {carreras.map((c) => (
                      <li key={c.id} className={cn("flex items-center gap-3 py-1.5", !c.activo && "opacity-70")}>
                        <span className="flex min-w-0 flex-1 flex-col">
                          <span className="text-sm text-pretty">
                            {c.nombre}
                            {!c.activo && (
                              <>
                                {" "}
                                <InactiveBadge label="Inactiva" />
                              </>
                            )}
                          </span>
                          <code className="truncate font-mono text-[11px] text-muted-foreground">{c.id}</code>
                        </span>
                        <span className="flex shrink-0 items-center">
                          <IconAction label={`Editar ${c.nombre}`} onClick={() => onDialog({ kind: "carrera", carrera: c })}>
                            <Pencil />
                          </IconAction>
                          <IconAction
                            label={c.activo ? `Desactivar ${c.nombre}` : `Reactivar ${c.nombre}`}
                            disabled={busy}
                            onClick={() => toggleCarrera(c)}
                          >
                            {c.activo ? <Power /> : <RotateCcw />}
                          </IconAction>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
