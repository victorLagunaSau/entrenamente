"use client";

import * as React from "react";
import { CircleAlert, CircleCheck, Loader2, Save } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/features/admin/ingest/components/fields";
import {
  DemoError,
  type DemoCampaignInput,
  fillTemplate,
  formatMxn,
  monthlyOfYearly,
  getDemoCampaign,
  saveDemoCampaign,
} from "@/features/student/services/demo-service";

import { AdminPageHeader } from "./admin-module";

const SAMPLE = { alias: "Sofi", carrera: "Medicina (UNAM)", universidad: "Universidad Nacional Autónoma de México" };

/** Textos, precio, pruebas gratis y estado de la campaña del Home Demo (demo_campaign_config). */
export function DemoCampaignWorkspace() {
  const [form, setForm] = React.useState<DemoCampaignInput | null>(null);
  const [status, setStatus] = React.useState<{ kind: "idle" | "saving" | "saved" } | { kind: "error"; text: string }>({ kind: "idle" });

  React.useEffect(() => {
    getDemoCampaign()
      .then((c) =>
        setForm({
          activa: c.activa,
          tituloCampana: c.tituloCampana,
          tituloBienvenida: c.tituloBienvenida,
          subtitulo: c.subtitulo,
          fraseCierre: c.fraseCierre,
          precioMensualMxn: c.precioMensualMxn,
          precioAnualMxn: c.precioAnualMxn,
          diasPrueba: c.diasPrueba,
          pruebasAlRegistrarse: c.pruebasAlRegistrarse,
        })
      )
      .catch((e: unknown) => setStatus({ kind: "error", text: e instanceof DemoError ? e.message : "No pudimos cargar la campaña." }));
  }, []);

  const set = <K extends keyof DemoCampaignInput>(key: K, value: DemoCampaignInput[K]) => {
    setForm((f) => f && { ...f, [key]: value });
    setStatus({ kind: "idle" });
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;
    setStatus({ kind: "saving" });
    try {
      await saveDemoCampaign(form);
      setStatus({ kind: "saved" });
    } catch (err) {
      setStatus({ kind: "error", text: err instanceof DemoError ? err.message : "No pudimos guardar la campaña." });
    }
  };

  const header = (
    <AdminPageHeader
      eyebrow="/admin/demo"
      title="Campaña de prueba gratuita"
      description="Lo que ve el estudiante sin plan en su Home Demo. Los cambios se aplican al instante."
    />
  );

  if (!form) {
    return (
      <div className="flex flex-col gap-6">
        {header}
        {status.kind === "error" ? (
          <ErrorLine text={status.text} />
        ) : (
          <div className="h-64 animate-pulse rounded-2xl bg-card motion-reduce:animate-none" aria-label="Cargando campaña" />
        )}
      </div>
    );
  }

  const preview = { ...SAMPLE, n: String(form.pruebasAlRegistrarse) };

  return (
    <div className="flex flex-col gap-6">
      {header}
      <form onSubmit={save} className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="flex flex-col gap-5 rounded-2xl border bg-card p-5 sm:p-6">
          <label className="flex items-start gap-3 rounded-xl border p-4">
            <input
              type="checkbox"
              checked={form.activa}
              onChange={(e) => set("activa", e.target.checked)}
              className="mt-0.5 size-5 accent-[var(--secondary)]"
            />
            <span className="flex flex-col gap-1">
              <span className="text-sm font-semibold">Campaña activa</span>
              <span className="text-xs text-muted-foreground text-pretty">
                Apagada, nadie puede presentar exámenes gratis (se bloquea en el servidor) y el Home Demo lo avisa.
              </span>
            </span>
          </label>

          <Field id="titulo" label="Título de la campaña" hint="Etiqueta sobre la bienvenida.">
            <Input id="titulo" value={form.tituloCampana} maxLength={60} required onChange={(e) => set("tituloCampana", e.target.value)} />
          </Field>
          <Field id="bienvenida" label="Bienvenida" hint="Marcadores: {alias}, {carrera}, {universidad}, {n}.">
            <Input
              id="bienvenida"
              value={form.tituloBienvenida}
              maxLength={160}
              required
              onChange={(e) => set("tituloBienvenida", e.target.value)}
            />
          </Field>
          <Field id="subtitulo" label="Subtítulo" hint="{n} = exámenes gratis del alumno.">
            <Textarea id="subtitulo" rows={3} value={form.subtitulo} maxLength={300} required onChange={(e) => set("subtitulo", e.target.value)} />
          </Field>
          <Field id="cierre" label="Frase del muro de pago">
            <Textarea id="cierre" rows={2} value={form.fraseCierre} maxLength={200} required onChange={(e) => set("fraseCierre", e.target.value)} />
          </Field>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field id="precio" label="Plan mensual (MXN)" hint="Precio base para descuentos futuros.">
              <Input
                id="precio"
                type="number"
                min={0}
                step="0.01"
                value={form.precioMensualMxn}
                required
                onChange={(e) => set("precioMensualMxn", Number(e.target.value))}
              />
            </Field>
            <Field id="anual" label="Plan anual (MXN)" hint={`Equivale a ${formatMxn(monthlyOfYearly(form.precioAnualMxn || 0))} / mes.`}>
              <Input
                id="anual"
                type="number"
                min={0}
                step="0.01"
                value={form.precioAnualMxn}
                required
                onChange={(e) => set("precioAnualMxn", Number(e.target.value))}
              />
            </Field>
            <Field id="dias" label="Días de prueba" hint="Solo para registros nuevos.">
              <Input
                id="dias"
                type="number"
                min={1}
                max={365}
                step={1}
                value={form.diasPrueba}
                required
                onChange={(e) => set("diasPrueba", Math.trunc(Number(e.target.value)))}
              />
            </Field>
            <Field id="pruebas" label="Exámenes gratis al registrarse" hint="Solo para registros nuevos: los ya registrados conservan los suyos.">
              <Input
                id="pruebas"
                type="number"
                min={0}
                max={20}
                step={1}
                value={form.pruebasAlRegistrarse}
                required
                onChange={(e) => set("pruebasAlRegistrarse", Math.trunc(Number(e.target.value)))}
              />
            </Field>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={status.kind === "saving"}>
              {status.kind === "saving" ? <Loader2 className="animate-spin motion-reduce:animate-none" /> : <Save />} Guardar campaña
            </Button>
            {status.kind === "saved" && (
              <span role="status" className="flex items-center gap-1.5 text-sm text-success">
                <CircleCheck className="size-4" /> Guardada
              </span>
            )}
            {status.kind === "error" && <ErrorLine text={status.text} />}
          </div>
        </div>

        <aside className="flex h-fit flex-col gap-3 rounded-2xl border bg-card p-5 lg:sticky lg:top-24">
          <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">Vista previa</p>
          <span className="w-fit rounded-full border border-brand-light/40 bg-primary/10 px-3 py-1 text-xs font-semibold text-brand-light">
            {form.tituloCampana || "—"}
          </span>
          <p className="text-lg font-bold text-balance">{fillTemplate(form.tituloBienvenida, preview)}</p>
          <p className="text-sm text-cool text-pretty">{fillTemplate(form.subtitulo, preview)}</p>
          <p className="border-t pt-3 text-sm text-muted-foreground text-pretty">{form.fraseCierre}</p>
          <p className="text-sm font-semibold text-energy">
            {formatMxn(form.precioMensualMxn || 0)} / mes · {formatMxn(form.precioAnualMxn || 0)} / año
          </p>
          <p className="text-xs text-muted-foreground">
            {form.pruebasAlRegistrarse} exámenes gratis durante {form.diasPrueba} días
          </p>
        </aside>
      </form>
    </div>
  );
}

function Field({ id, label, hint, children }: { id: string; label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function ErrorLine({ text }: { text: string }) {
  return (
    <p role="alert" className="flex items-center gap-2 text-sm text-destructive">
      <CircleAlert className="size-4 shrink-0" /> {text}
    </p>
  );
}
