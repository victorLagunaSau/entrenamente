"use client";

import * as React from "react";
import { CircleCheck, Copy, Loader2, Pause, Play, Plus, Save, Zap } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, Textarea } from "@/features/admin/ingest/components/fields";
import {
  type AdminExperiment,
  type AdminFlashSale,
  type AdminPlan,
  getPricingAdmin,
  type PricingAdmin,
  saveExperiment,
  saveFlashSale,
  savePlan,
  setFlashSaleActive,
} from "@/features/admin/services/revenue-service";
import {
  formatMxn,
  INTERVAL_LABEL,
  VARIANT_LABEL,
  type BillingInterval,
  type PricingRole,
  type Variant,
  type VariantConfig,
} from "@/features/pricing/lib/pricing";
import { cn } from "@/lib/utils";

import { ErrorLine, errorText, formatDateTime } from "./revenue-workspace";

const ROLE_LABEL = { student: "Estudiantes", parent: "Padres y tutores", teacher: "Maestros", institution: "Instituciones" };
const CYCLES: BillingInterval[] = ["monthly", "quarterly", "annual"];

/** Pestaña 3: ofertas flash, precios de los planes y precios de cada variante del experimento. */
export function CatalogTab() {
  const [data, setData] = React.useState<PricingAdmin | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(() => {
    getPricingAdmin()
      .then(setData)
      .catch((e) => setError(errorText(e, "No pudimos cargar los planes.")));
  }, []);
  React.useEffect(load, [load]);

  if (!data) return error ? <ErrorLine text={error} /> : <div className="h-80 animate-pulse rounded-2xl bg-card motion-reduce:animate-none" />;

  // Por ahora solo se venden planes de Estudiantes y de Padres/Tutores.
  const plans = data.plans.filter((p) => p.target_role === "student" || p.target_role === "parent");

  return (
    <div className="flex flex-col gap-8">
      <FlashSales plans={plans} sales={data.flash_sales} onChange={load} />
      <section aria-labelledby="plans-admin-title" className="flex flex-col gap-3">
        <div>
          <h2 id="plans-admin-title" className="text-lg font-bold">
            Planes
          </h2>
          <p className="text-sm text-muted-foreground">
            Precio base de cada plan. El Plan Estudiante muestra los precios de la variante A/B de cada usuario (abajo); estos
            se usan cuando no hay experimento activo.
          </p>
        </div>
        <div className="grid gap-3 lg:grid-cols-2">
          {plans.map((p) => (
            <PlanEditor key={p.id} plan={p} onSaved={load} />
          ))}
        </div>
      </section>
      <Experiments experiments={data.experiments} plans={plans} onChange={load} />
    </div>
  );
}

// ───────────────────────── Ofertas flash ─────────────────────────

const toLocalInput = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);

function saleState(s: AdminFlashSale, now: number) {
  if (!s.is_active) return { label: "Pausada", className: "bg-muted text-cool" };
  if (new Date(s.expires_at).getTime() < now) return { label: "Terminada", className: "bg-muted text-cool" };
  if (new Date(s.starts_at).getTime() > now) return { label: "Programada", className: "bg-primary/15 text-brand-light" };
  return { label: "En curso", className: "bg-success/15 text-success" };
}

function FlashSales({ plans, sales, onChange }: { plans: AdminPlan[]; sales: AdminFlashSale[]; onChange: () => void }) {
  const now = Date.now();
  const [form, setForm] = React.useState(() => ({
    kind: "pct" as "pct" | "fixed",
    title: "Especial Fin de Semana",
    role: "student" as PricingRole,
    planId: "",
    cycle: "monthly" as BillingInterval,
    price: "",
    pct: "40",
    durationDays: "",
    startsAt: toLocalInput(new Date()),
    expiresAt: toLocalInput(new Date(Date.now() + 3 * 86_400_000)),
  }));
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const plan = plans.find((p) => p.id === form.planId);
  const fixed = form.kind === "fixed";
  const rolePlans = plans.filter((p) => p.target_role === form.role);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await saveFlashSale({
        id: null,
        title: form.title,
        role: form.role,
        planId: form.planId || null,
        cycle: form.cycle,
        price: fixed ? Number(form.price) : null,
        pct: fixed ? null : Number(form.pct),
        durationDays: form.durationDays ? Number(form.durationDays) : null,
        startsAt: new Date(form.startsAt).toISOString(),
        expiresAt: new Date(form.expiresAt).toISOString(),
        active: true,
      });
      setForm((f) => ({ ...f, price: "" }));
      onChange();
    } catch (err) {
      setError(errorText(err, "No pudimos crear la oferta."));
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (s: AdminFlashSale) => {
    try {
      await setFlashSaleActive(s.id, !s.is_active);
      onChange();
    } catch (err) {
      setError(errorText(err, "No pudimos cambiar la oferta."));
    }
  };

  return (
    <section aria-labelledby="flash-title" className="flex flex-col gap-3">
      <div>
        <h2 id="flash-title" className="flex items-center gap-2 text-lg font-bold">
          <Zap className="size-5 text-energy" aria-hidden /> Ofertas flash
        </h2>
        <p className="text-sm text-muted-foreground">
          Se muestran como banner sobre los planes del rol mientras estén en curso. Por porcentaje, el descuento se aplica a
          los precios de las tarjetas (redondeado a pesos por plan o por estudiante, como en Stripe). Nunca cambian la variante
          A/B del usuario: al terminar, cada quien vuelve a ver sus precios de siempre.
        </p>
      </div>

      <form onSubmit={create} className="grid gap-3 rounded-2xl border bg-card p-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Título" className="sm:col-span-2">
          <Input value={form.title} onChange={(e) => set("title", e.target.value)} className="h-11" required />
        </Field>
        <Field label="Tipo">
          <NativeSelect value={form.kind} onChange={(e) => setForm((f) => ({ ...f, kind: e.target.value as "pct" | "fixed", planId: "" }))}>
            <option value="pct">% de descuento</option>
            <option value="fixed">Precio fijo de un plan</option>
          </NativeSelect>
        </Field>
        <Field label="Para">
          <NativeSelect value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as PricingRole, planId: "" }))}>
            <option value="student">{ROLE_LABEL.student}</option>
            <option value="parent">{ROLE_LABEL.parent}</option>
          </NativeSelect>
        </Field>
        <Field label="Plan">
          <NativeSelect value={form.planId} onChange={(e) => set("planId", e.target.value)} required={fixed}>
            {fixed ? <option value="">Elige…</option> : <option value="">Todos los planes</option>}
            {rolePlans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </NativeSelect>
        </Field>
        {fixed ? (
          <>
            <Field label="Periodo">
              <NativeSelect value={form.cycle} onChange={(e) => set("cycle", e.target.value)}>
                {CYCLES.map((c) => (
                  <option key={c} value={c}>
                    {INTERVAL_LABEL[c].name}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Precio de oferta (MXN)">
              <Input
                type="number"
                min={0}
                value={form.price}
                onChange={(e) => set("price", e.target.value)}
                placeholder={plan ? `Normal ${formatMxn(Number(plan.base_price_monthly))}/mes` : undefined}
                className="h-11"
                required
              />
            </Field>
          </>
        ) : (
          <Field label="Descuento (%)">
            <Input type="number" min={1} max={99} value={form.pct} onChange={(e) => set("pct", e.target.value)} className="h-11" required />
          </Field>
        )}
        <Field label="Días de licencia">
          <Input
            type="number"
            min={1}
            value={form.durationDays}
            onChange={(e) => set("durationDays", e.target.value)}
            placeholder="Los del periodo"
            className="h-11"
          />
        </Field>
        <Field label="Inicio">
          <Input type="datetime-local" value={form.startsAt} onChange={(e) => set("startsAt", e.target.value)} className="h-11" required />
        </Field>
        <Field label="Cierre">
          <Input type="datetime-local" value={form.expiresAt} onChange={(e) => set("expiresAt", e.target.value)} className="h-11" required />
        </Field>
        <div className="flex flex-col gap-2 sm:col-span-2 lg:col-span-4">
          {error && <ErrorLine text={error} />}
          <Button type="submit" variant="brand" className="h-11 sm:w-fit" disabled={busy}>
            {busy ? <Loader2 className="animate-spin motion-reduce:animate-none" /> : <Plus />} Crear oferta
          </Button>
        </div>
      </form>

      {sales.length > 0 && (
        <ul className="flex flex-col gap-2">
          {sales.map((s) => {
            const st = saleState(s, now);
            return (
              <li key={s.id} className="flex flex-wrap items-center gap-3 rounded-xl border bg-card px-4 py-3 text-sm">
                <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold", st.className)}>{st.label}</span>
                <span className="min-w-0 flex-1">
                  <span className="font-semibold">{s.title}</span>{" "}
                  <span className="text-muted-foreground">
                    · {ROLE_LABEL[s.target_role]} · {s.plan_id ? plans.find((p) => p.id === s.plan_id)?.name ?? s.plan_id : "todos los planes"}{" "}
                    {s.discount_pct
                      ? `−${Math.round(Number(s.discount_pct))} %`
                      : `${formatMxn(Number(s.discounted_price))} / ${INTERVAL_LABEL[s.billing_cycle].per}`}
                    {s.duration_days && ` · ${s.duration_days} días`} · {formatDateTime(s.starts_at)} → {formatDateTime(s.expires_at)}
                  </span>
                </span>
                <Button size="sm" variant="ghost" onClick={() => void toggle(s)}>
                  {s.is_active ? <Pause /> : <Play />} {s.is_active ? "Pausar" : "Reanudar"}
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

// ───────────────────────── Planes ─────────────────────────

function PlanEditor({ plan, onSaved }: { plan: AdminPlan; onSaved: () => void }) {
  const [p, setP] = React.useState(plan);
  const [features, setFeatures] = React.useState(plan.features.join("\n"));
  const [status, setStatus] = React.useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = React.useState<string | null>(null);
  const set = <K extends keyof AdminPlan>(k: K, v: AdminPlan[K]) => {
    setP((x) => ({ ...x, [k]: v }));
    setStatus("idle");
  };
  const perStudent = p.max_students > p.min_students;

  const save = async () => {
    setStatus("saving");
    setError(null);
    try {
      await savePlan({ ...p, features: features.split("\n").map((f) => f.trim()).filter(Boolean) });
      setStatus("saved");
      onSaved();
    } catch (e) {
      setError(errorText(e, "No pudimos guardar el plan."));
      setStatus("idle");
    }
  };

  return (
    <article className="flex flex-col gap-3 rounded-2xl border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          {ROLE_LABEL[p.target_role]} · <span className="font-mono normal-case">{p.id}</span>
        </p>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={p.is_active} onChange={(e) => set("is_active", e.target.checked)} className="size-4 accent-[var(--secondary)]" />
          Activo
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Nombre">
          <Input value={p.name} onChange={(e) => set("name", e.target.value)} className="h-10" />
        </Field>
        <Field label="Etiqueta destacada">
          <Input value={p.badge ?? ""} onChange={(e) => set("badge", e.target.value)} placeholder="Ej. Plan más popular" className="h-10" />
        </Field>
        <Field label={perStudent ? `Mensual base (${p.min_students} estudiantes)` : "Mensual (MXN)"}>
          <Input type="number" min={0} value={p.base_price_monthly} onChange={(e) => set("base_price_monthly", Number(e.target.value))} className="h-10" />
        </Field>
        <Field label="Anual (MXN)">
          <Input
            type="number"
            min={0}
            value={p.base_price_annual ?? ""}
            onChange={(e) => set("base_price_annual", e.target.value === "" ? null : Number(e.target.value))}
            className="h-10"
          />
        </Field>
        {perStudent && (
          <Field label="Por estudiante adicional / mes">
            <Input
              type="number"
              min={0}
              value={p.extra_student_price_monthly}
              onChange={(e) => set("extra_student_price_monthly", Number(e.target.value))}
              className="h-10"
            />
          </Field>
        )}
      </div>
      <Field label="Descripción">
        <Input value={p.description ?? ""} onChange={(e) => set("description", e.target.value)} className="h-10" />
      </Field>
      <Field label="Beneficios (uno por renglón)">
        <Textarea value={features} onChange={(e) => (setFeatures(e.target.value), setStatus("idle"))} rows={4} />
      </Field>
      {error && <ErrorLine text={error} />}
      <SaveButton status={status} onClick={() => void save()} />
    </article>
  );
}

// ───────────────────────── Experimentos ─────────────────────────

function Experiments({ experiments, plans, onChange }: { experiments: AdminExperiment[]; plans: AdminPlan[]; onChange: () => void }) {
  const [selected, setSelected] = React.useState(experiments[0]?.id ?? "");
  const exp = experiments.find((e) => e.id === selected) ?? experiments[0];

  return (
    <section aria-labelledby="exp-admin-title" className="flex flex-col gap-3">
      <div>
        <h2 id="exp-admin-title" className="text-lg font-bold">
          Precios por variante (A/B)
        </h2>
        <p className="text-sm text-muted-foreground">
          Cada usuario recibe al azar la A o la B la primera vez y la conserva para siempre. Activa o pausa experimentos en la
          pestaña Funnel y A/B.
        </p>
      </div>
      {experiments.length > 1 && (
        <NativeSelect value={exp?.id ?? ""} onChange={(e) => setSelected(e.target.value)} aria-label="Experimento">
          {experiments.map((e) => (
            <option key={e.id} value={e.id}>
              {e.experiment_name} · {e.status}
            </option>
          ))}
        </NativeSelect>
      )}
      {exp ? (
        <ExperimentEditor key={exp.id} experiment={exp} plans={plans} onSaved={onChange} />
      ) : (
        <p className="rounded-2xl border bg-card p-5 text-sm text-muted-foreground">No hay experimentos.</p>
      )}
    </section>
  );
}

function ExperimentEditor({ experiment, plans, onSaved }: { experiment: AdminExperiment; plans: AdminPlan[]; onSaved: () => void }) {
  const [name, setName] = React.useState(experiment.experiment_name);
  const [configs, setConfigs] = React.useState<Record<Variant, VariantConfig>>({
    variant_a: experiment.variant_a_config,
    variant_b: experiment.variant_b_config,
  });
  const [status, setStatus] = React.useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = React.useState<string | null>(null);
  const rolePlans = plans.filter((p) => p.target_role === experiment.target_role);

  const setOffer = (v: Variant, i: number, patch: Partial<VariantConfig["offers"][number]>) => {
    setConfigs((c) => ({ ...c, [v]: { offers: c[v].offers.map((o, j) => (j === i ? { ...o, ...patch } : o)) } }));
    setStatus("idle");
  };

  const save = async (asNew: boolean) => {
    setStatus("saving");
    setError(null);
    try {
      await saveExperiment({
        id: asNew ? null : experiment.id,
        name: asNew ? `${name} (copia)` : name,
        role: experiment.target_role,
        a: configs.variant_a,
        b: configs.variant_b,
      });
      setStatus("saved");
      onSaved();
    } catch (e) {
      setError(errorText(e, "No pudimos guardar el experimento."));
      setStatus("idle");
    }
  };

  return (
    <div className="flex flex-col gap-3 rounded-2xl border bg-card p-4">
      <Field label="Nombre del experimento">
        <Input value={name} onChange={(e) => (setName(e.target.value), setStatus("idle"))} className="h-10" />
      </Field>
      <div className="grid gap-3 lg:grid-cols-2">
        {(["variant_a", "variant_b"] as const).map((v) => (
          <div key={v} className="flex flex-col gap-2 rounded-xl bg-muted/40 p-3">
            <p className="font-semibold">{VARIANT_LABEL[v]}</p>
            {configs[v].offers.map((o, i) => (
              <div key={i} className="grid grid-cols-[1fr_1fr_6rem] gap-2">
                <NativeSelect value={o.plan_id} onChange={(e) => setOffer(v, i, { plan_id: e.target.value })} aria-label="Plan" className="h-10">
                  {rolePlans.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </NativeSelect>
                <NativeSelect
                  value={o.interval}
                  onChange={(e) => setOffer(v, i, { interval: e.target.value as BillingInterval })}
                  aria-label="Periodo"
                  className="h-10"
                >
                  {CYCLES.map((c) => (
                    <option key={c} value={c}>
                      {INTERVAL_LABEL[c].name}
                    </option>
                  ))}
                </NativeSelect>
                <Input
                  type="number"
                  min={0}
                  value={o.price}
                  onChange={(e) => setOffer(v, i, { price: Number(e.target.value) })}
                  aria-label="Precio MXN"
                  className="h-10"
                />
              </div>
            ))}
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        Cambiar precios de un experimento que ya corre mezcla datos en sus métricas; para comparar precios nuevos, guarda como
        experimento nuevo (nace pausado) y actívalo en Funnel y A/B.
      </p>
      {error && <ErrorLine text={error} />}
      <div className="flex flex-wrap gap-2">
        <SaveButton status={status} onClick={() => void save(false)} />
        <Button variant="outline" onClick={() => void save(true)} disabled={status === "saving"}>
          <Copy /> Guardar como experimento nuevo
        </Button>
      </div>
    </div>
  );
}

// ───────────────────────── Comunes ─────────────────────────

function SaveButton({ status, onClick }: { status: "idle" | "saving" | "saved"; onClick: () => void }) {
  return (
    <Button variant="brand" onClick={onClick} disabled={status === "saving"} className="sm:w-fit">
      {status === "saving" ? (
        <Loader2 className="animate-spin motion-reduce:animate-none" />
      ) : status === "saved" ? (
        <CircleCheck />
      ) : (
        <Save />
      )}
      {status === "saved" ? "Guardado" : "Guardar"}
    </Button>
  );
}

function Field({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <label className={cn("flex min-w-0 flex-col gap-1.5 text-sm", className)}>
      <span className="text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
