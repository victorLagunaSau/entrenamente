"use client";

import * as React from "react";
import { CircleAlert, Sparkles } from "lucide-react";

import { UniversityBadge } from "@/components/layout/university-badge";
import { getCatalogo } from "@/features/escuelas/services/catalogo-service";

import { DemoError, type DemoCampaign, fillTemplate, type FreeExam, getDemoCampaign, getFreeExams } from "../../services/demo-service";
import { getStudentSummary, type StudentSummary } from "../../services/student-service";
import { DemoPath, type PathBlock } from "./demo-path";
import { DemoGuide, DemoGuidePlaceholder, DemoStats } from "./demo-results";
import { PlansSection } from "./demo-plans";
import { PaywallBar, PlansDialog, UnlimitedSection, type UnlockFocus } from "./demo-upsell";

type Goal = { careerId: string; careerName: string; universityId: string; universityShort: string; universityName: string };

type DemoData = { summary: StudentSummary; campaign: DemoCampaign; exams: FreeExam[]; goal: Goal | null };

/**
 * Home Demo (/app/student/home-demo): bienvenida de la campaña → plan inicial gratuito (exámenes + cuenta
 * regresiva) → métricas y guía quirúrgica (tras el primer examen) → "Entrena sin límites" (propuesta de
 * valor) → Planes → letrero flotante. Textos, precios y estado de la campaña vienen del admin; el número de exámenes
 * y la fecha límite, de lo que recibió el alumno al registrarse.
 */
export function DemoHome() {
  const [data, setData] = React.useState<DemoData | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [unlock, setUnlock] = React.useState<{ open: boolean; focus: UnlockFocus }>({ open: false, focus: null });

  React.useEffect(() => {
    let active = true;
    (async () => {
      const summary = await getStudentSummary();
      if (!summary) throw new DemoError("Inicia sesión para ver tu prueba gratuita.");
      const [campaign, exams, catalogo] = await Promise.all([getDemoCampaign(), getFreeExams(summary.id), getCatalogo()]);

      const inst = catalogo.find((i) => i.id === summary.goal?.universityId);
      const carrera = inst?.carreras.find((c) => c.id === summary.goal?.careerId);
      const goal =
        inst && carrera
          ? { careerId: carrera.id, careerName: carrera.nombre, universityId: inst.id, universityShort: inst.clave, universityName: inst.nombre }
          : null;
      if (active) setData({ summary, campaign, exams, goal });
    })().catch((e: unknown) => active && setError(e instanceof DemoError ? e.message : "No pudimos cargar tu prueba gratuita. Recarga la página."));
    return () => {
      active = false;
    };
  }, []);

  if (error) {
    return (
      <p
        role="alert"
        className="flex items-center gap-2 rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive"
      >
        <CircleAlert className="size-4 shrink-0" /> {error}
      </p>
    );
  }
  if (!data) {
    return (
      <div className="flex flex-col gap-6" aria-label="Cargando tu prueba gratuita">
        <div className="h-44 animate-pulse rounded-3xl bg-card motion-reduce:animate-none" />
        <div className="h-40 animate-pulse rounded-2xl bg-card motion-reduce:animate-none" />
      </div>
    );
  }

  const { summary, campaign, exams, goal } = data;
  const total = campaign.pruebasOtorgadas;
  const openPlans = (focus: UnlockFocus = null) => setUnlock({ open: true, focus });
  const prices = { monthly: campaign.precioMensualMxn, yearly: campaign.precioAnualMxn };
  const expired = campaign.pruebaTermina !== null && new Date(campaign.pruebaTermina).getTime() <= Date.now();
  const block: PathBlock = !goal ? "sin-meta" : expired ? "vencido" : !campaign.activa ? "pausa" : null;
  const texts = {
    alias: summary.alias,
    carrera: goal ? `${goal.careerName} (${goal.universityShort})` : "tu examen de admisión",
    universidad: goal?.universityName ?? "tu universidad",
    n: String(total),
  };

  return (
    <>
      <section id="saludo" className="relative flex scroll-mt-20 flex-col gap-3 overflow-hidden rounded-3xl border bg-card p-5 sm:p-8">
        <div aria-hidden className="pointer-events-none absolute -top-24 -right-24 size-64 rounded-full bg-brand-gradient opacity-15 blur-3xl" />
        <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-brand-light/40 bg-primary/10 px-3 py-1 text-xs font-semibold text-brand-light">
          <Sparkles className="size-3.5" aria-hidden /> {campaign.tituloCampana}
        </span>
        <h1 className="text-2xl font-bold text-balance sm:text-3xl">{fillTemplate(campaign.tituloBienvenida, texts)}</h1>
        <p className="max-w-2xl text-cool text-pretty">{fillTemplate(campaign.subtitulo, texts)}</p>
        {goal && (
          <div className="flex min-w-0 items-center gap-3 pt-1">
            <UniversityBadge id={goal.universityId} label={goal.universityShort} size="sm" />
            <span className="min-w-0 truncate text-sm text-cool">
              <span className="text-muted-foreground">Meta · </span>
              {goal.careerName}
            </span>
          </div>
        )}
      </section>

      <DemoPath
        total={total}
        used={campaign.pruebasUsadas}
        exams={exams}
        careerId={goal?.careerId ?? null}
        endsAt={campaign.pruebaTermina}
        block={block}
        onUnlock={() => openPlans()}
      />

      {exams.length > 0 ? (
        <>
          <DemoStats exams={exams} total={total} />
          <DemoGuide exams={exams} />
        </>
      ) : (
        <DemoGuidePlaceholder />
      )}

      <UnlimitedSection prices={prices} phrase={campaign.fraseCierre} onUnlock={openPlans} />
      <PlansSection prices={prices} />

      {/* Espacio para que el muro flotante no tape el pie del home. */}
      <div aria-hidden className="h-16 sm:h-12" />
      <PaywallBar phrase={campaign.fraseCierre} prices={prices} onUnlock={() => openPlans()} />
      <PlansDialog
        open={unlock.open}
        focus={unlock.focus}
        phrase={campaign.fraseCierre}
        prices={prices}
        onOpenChange={(open) => setUnlock((u) => ({ ...u, open }))}
      />
    </>
  );
}
