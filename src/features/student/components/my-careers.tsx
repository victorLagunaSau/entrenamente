"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, CalendarCheck, CircleAlert, GraduationCap, Loader2, Lock, Plus, Star, Trash2 } from "lucide-react";

import { UniversityBadge } from "@/components/layout/university-badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CareerPicker, selectableCatalog } from "@/features/escuelas/components/career-picker";
import { getCatalogo } from "@/features/escuelas/services/catalogo-service";
import type { Institucion } from "@/features/escuelas/types";
import { ModeGuard } from "@/features/modes/components/mode-guard";
import { PanelShell } from "@/features/modes/components/panel-shell";
import { getMyPlans } from "@/features/plan/services/plan-service";

import { type DemoCampaign, getDemoCampaign } from "../services/demo-service";
import { getStudentCareers, type StudentCareer } from "../services/student-careers-service";
import { addGoal, goalErrorMessage, MAX_GOALS, MY_CAREERS_PATH, removeGoal } from "../services/student-goals-service";
import { getStudentSummary } from "../services/student-service";
import { PlansDialog } from "./demo/demo-upsell";
import { AddSchoolMenuItem } from "./add-school-menu-item";

/**
 * Mis carreras: metas Universidad → Carrera del alumno, hasta MAX_GOALS. Una meta nunca se cambia por otra
 * (rompería su historial): solo se agrega o se quita. Demo mantiene 1 y "Agregar otra carrera" abre el modal
 * de planes; con suscripción agrega y quita.
 */
export function MyCareersPanel() {
  return (
    <ModeGuard mode="student">
      <PanelShell accountExtra={<AddSchoolMenuItem />}>
        <React.Suspense fallback={<Skeleton />}>
          <MyCareers />
        </React.Suspense>
      </PanelShell>
    </ModeGuard>
  );
}

function Skeleton() {
  return <div className="h-40 animate-pulse rounded-2xl bg-card motion-reduce:animate-none" aria-label="Cargando tus carreras" />;
}

type Data = {
  pro: boolean;
  careers: StudentCareer[];
  /** Carreras con plan activo: no se quitan. */
  withPlan: Set<string>;
  campaign: DemoCampaign | null;
};

function MyCareers() {
  const router = useRouter();
  const wantsAdd = useSearchParams().get("agregar") === "1";
  const [data, setData] = React.useState<Data | null | undefined>(undefined);
  const [failed, setFailed] = React.useState(false);
  const [adding, setAdding] = React.useState(false);
  const [removing, setRemoving] = React.useState<StudentCareer | null>(null);
  const [paywall, setPaywall] = React.useState(false);
  const autoOpened = React.useRef(false);

  const load = React.useCallback(async () => {
    const summary = await getStudentSummary();
    if (!summary) return setData(null);
    const pro = summary.access.status === "active";
    // Sin las tablas del plan (migración pendiente) ninguna carrera queda bloqueada por plan.
    const [careers, plans, campaign] = await Promise.all([
      getStudentCareers(summary.id),
      getMyPlans().catch(() => []),
      pro ? null : getDemoCampaign().catch(() => null),
    ]);
    setData({ pro, careers, withPlan: new Set(plans.map((p) => p.careerId)), campaign });
  }, []);

  React.useEffect(() => {
    load().catch(() => setFailed(true));
  }, [load]);

  const full = (data?.careers.length ?? 0) >= MAX_GOALS;

  const requestAdd = React.useCallback(() => {
    if (!data) return;
    if (!data.pro) {
      if (data.campaign) setPaywall(true);
      else router.push("/acceso-ilimitado");
      return;
    }
    if (data.careers.length < MAX_GOALS) setAdding(true);
  }, [data, router]);

  // "Agregar escuela" desde el home o el menú llega con ?agregar=1: se abre una sola vez y se limpia la URL.
  React.useEffect(() => {
    if (!wantsAdd || !data || autoOpened.current) return;
    autoOpened.current = true;
    requestAdd();
    router.replace(MY_CAREERS_PATH, { scroll: false });
  }, [wantsAdd, data, requestAdd, router]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Button variant="ghost" size="sm" className="self-start" asChild>
          <Link href="/app/student">
            <ArrowLeft /> Inicio
          </Link>
        </Button>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 font-display text-2xl font-bold">
              <GraduationCap className="size-6 text-secondary" aria-hidden /> Mis carreras
            </h1>
            <p className="mt-1 text-sm text-muted-foreground text-pretty">
              Tus metas académicas. Para cada una entrenas exámenes libres, rachas y planes con el formato de su universidad.
            </p>
          </div>
          {data && (
            <span className="rounded-full bg-muted px-3 py-1 text-xs font-semibold text-cool">
              {data.careers.length} de {MAX_GOALS}
            </span>
          )}
        </div>
      </div>

      {failed ? (
        <p
          role="alert"
          className="flex items-center gap-2 rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive"
        >
          <CircleAlert className="size-4 shrink-0" /> No pudimos cargar tus carreras. Recarga la página.
        </p>
      ) : data === undefined ? (
        <Skeleton />
      ) : data === null ? null : (
        <>
          <ul className="flex flex-col gap-3" aria-label="Tus carreras">
            {data.careers.map((c, i) => {
              const locked = data.withPlan.has(c.id);
              const lastOne = data.careers.length <= 1;
              return (
                <li key={c.id} className="flex flex-wrap items-center gap-3 rounded-2xl border bg-card p-4 sm:p-5">
                  <UniversityBadge id={c.universityId} label={c.universityShort} />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-balance">{c.name}</p>
                    <div className="mt-1 flex flex-wrap gap-2 text-xs">
                      {i === 0 && (
                        <span className="inline-flex items-center gap-1 text-gold">
                          <Star className="size-3 fill-gold" aria-hidden /> Meta inicial
                        </span>
                      )}
                      {locked && (
                        <span className="inline-flex items-center gap-1 text-secondary">
                          <CalendarCheck className="size-3" aria-hidden /> Plan activo
                        </span>
                      )}
                    </div>
                  </div>
                  {data.pro && (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={locked || lastOne}
                      title={
                        locked
                          ? "Tiene un plan activo: cancélalo antes de quitarla."
                          : lastOne
                            ? "Necesitas al menos una carrera."
                            : undefined
                      }
                      onClick={() => setRemoving(c)}
                      aria-label={`Quitar ${c.name}`}
                    >
                      <Trash2 /> Quitar
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>

          {data.pro && full ? (
            <p className="rounded-2xl border border-dashed p-4 text-center text-sm text-muted-foreground">
              Has alcanzado el límite máximo de {MAX_GOALS} carreras simultáneas.
            </p>
          ) : (
            <button
              type="button"
              onClick={requestAdd}
              className="flex min-h-14 items-center justify-center gap-2 rounded-2xl border border-dashed p-4 text-sm font-semibold text-brand-light transition-colors hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              {data.pro ? <Plus className="size-4" aria-hidden /> : <Lock className="size-4" aria-hidden />}
              Agregar otra carrera
              {!data.pro && (
                <span className="rounded-full bg-energy/15 px-2 py-0.5 text-[10px] font-bold tracking-wide text-energy uppercase">
                  Plan Pro
                </span>
              )}
            </button>
          )}

          <AddGoalDialog
            open={adding}
            careers={data.careers}
            onOpenChange={setAdding}
            onSaved={load}
          />
          <RemoveDialog career={removing} onOpenChange={(open) => !open && setRemoving(null)} onRemoved={load} />
          {data.campaign && (
            <PlansDialog
              open={paywall}
              focus="carreras"
              phrase={data.campaign.fraseCierre}
              prices={{ monthly: data.campaign.precioMensualMxn, yearly: data.campaign.precioAnualMxn }}
              onOpenChange={setPaywall}
            />
          )}
        </>
      )}
    </div>
  );
}

function FormError({ text }: { text: string }) {
  if (!text) return null;
  return (
    <p role="alert" className="flex items-center gap-2 text-sm text-destructive">
      <CircleAlert className="size-4 shrink-0" /> {text}
    </p>
  );
}

/** Agregar una carrera del catálogo oficial. */
function AddGoalDialog({
  open,
  careers,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  careers: StudentCareer[];
  onOpenChange: (open: boolean) => void;
  onSaved: () => Promise<void>;
}) {
  const [catalog, setCatalog] = React.useState<Institucion[] | null>(null);
  const [uni, setUni] = React.useState<string | null>(null);
  const [career, setCareer] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    if (!open) return;
    setCareer(null);
    setError("");
    setUni(careers[0]?.universityId ?? null);
    if (catalog) return;
    getCatalogo()
      .then((c) => {
        const active = selectableCatalog(c);
        setCatalog(active);
        setUni((u) => (u && active.some((i) => i.id === u) ? u : (active[0]?.id ?? null)));
      })
      .catch(() => setError("No pudimos cargar el catálogo de carreras."));
  }, [open, catalog, careers]);

  const taken = React.useMemo(() => new Set(careers.map((c) => c.id)), [careers]);

  const save = async () => {
    if (!career) return;
    setSaving(true);
    setError("");
    try {
      await addGoal(career);
      await onSaved();
      onOpenChange(false);
    } catch (e) {
      setError(goalErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Agregar otra carrera</DialogTitle>
          <DialogDescription>
            Elige la universidad y la carrera a la que también aspiras: entrenarás con el formato de su examen.
          </DialogDescription>
        </DialogHeader>

        {!catalog ? (
          error ? (
            <FormError text={error} />
          ) : (
            <div className="grid min-h-40 place-items-center" role="status" aria-label="Cargando catálogo">
              <Loader2 className="size-6 animate-spin text-brand-light motion-reduce:animate-none" />
            </div>
          )
        ) : (
          <>
            <CareerPicker
              catalog={catalog}
              university={uni}
              career={career}
              taken={taken}
              takenLabel="Ya es tu meta"
              onUniversityChange={(id) => {
                setUni(id);
                setCareer(null);
              }}
              onCareerChange={setCareer}
            />
            <FormError text={error} />
          </>
        )}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button variant="brand" disabled={!career || saving} onClick={save}>
            {saving ? <Loader2 className="animate-spin" /> : <Plus />} Agregar carrera
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function RemoveDialog({
  career,
  onOpenChange,
  onRemoved,
}: {
  career: StudentCareer | null;
  onOpenChange: (open: boolean) => void;
  onRemoved: () => Promise<void>;
}) {
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState("");

  React.useEffect(() => setError(""), [career]);

  const remove = async () => {
    if (!career) return;
    setSaving(true);
    setError("");
    try {
      await removeGoal(career.id);
      await onRemoved();
      onOpenChange(false);
    } catch (e) {
      setError(goalErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={career !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>¿Quitar esta carrera?</DialogTitle>
          <DialogDescription>
            {career?.name} ({career?.universityShort}) deja de aparecer en tu inicio. Tus exámenes y guías de errores se conservan, y
            puedes volver a agregarla cuando quieras.
          </DialogDescription>
        </DialogHeader>
        <FormError text={error} />
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button variant="secondary" disabled={saving} onClick={remove}>
            {saving ? <Loader2 className="animate-spin" /> : <Trash2 />} Quitar carrera
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
