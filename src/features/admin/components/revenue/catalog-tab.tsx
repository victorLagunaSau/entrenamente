"use client";

import * as React from "react";
import { FlaskConical, Loader2, Minus, Pause, Pencil, Play, Plus, Save, Zap } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect, Textarea } from "@/features/admin/ingest/components/fields";
import {
  type AdminExperiment,
  type AdminFlashSale,
  type AdminPlan,
  getPlanSales,
  getPricingAdmin,
  type PlanSales,
  type PricingAdmin,
  saveExperiment,
  saveFlashSale,
  savePlan,
  setExperimentStatus,
  setFlashSaleActive,
} from "@/features/admin/services/revenue-service";
import {
  discounted,
  formatMxn,
  INTERVAL_LABEL,
  INTERVAL_MONTHS,
  VARIANT_LABEL,
  type BillingInterval,
  type OfferConfig,
  type PricingRole,
  type Variant,
  type VariantConfig,
} from "@/features/pricing/lib/pricing";
import { cn } from "@/lib/utils";

import { ErrorLine, errorText, formatDateTime } from "./revenue-workspace";

const CYCLES: BillingInterval[] = ["monthly", "quarterly", "annual"];
const VARIANTS: Variant[] = ["variant_a", "variant_b"];

const SECTION: Record<PricingRole, { title: string; subtitle: string; subtitleAb?: string }> = {
  student: {
    title: "Plan Estudiante",
    subtitle: "Un solo plan. Cada estudiante ve los periodos y precios de su variante A/B.",
  },
  parent: {
    title: "Planes Padre / Tutor",
    subtitle: "Tutor, Dúo y Familia. Todos los padres y tutores ven los mismos precios.",
    subtitleAb: "Tutor, Dúo y Familia. Cada padre o tutor ve los precios de su variante A/B; lo que el A/B no cambia, al precio base.",
  },
};

/** Padres: solo mensual y anual (como en sus tarjetas y en Stripe). */
const PARENT_CYCLES: BillingInterval[] = ["monthly", "annual"];

/** Pestaña 3: un bloque por rol con su oferta, sus precios reales, sus ventas y las acciones de cada plan. */
export function CatalogTab() {
  const [data, setData] = React.useState<PricingAdmin | null>(null);
  const [sales, setSales] = React.useState<PlanSales[]>([]);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(() => {
    Promise.all([getPricingAdmin(), getPlanSales()])
      .then(([d, s]) => {
        setData(d);
        setSales(s);
      })
      .catch((e) => setError(errorText(e, "No pudimos cargar los planes.")));
  }, []);
  React.useEffect(load, [load]);

  if (!data) return error ? <ErrorLine text={error} /> : <div className="h-80 animate-pulse rounded-2xl bg-card motion-reduce:animate-none" />;

  return (
    <div className="flex flex-col gap-8">
      {(["student", "parent"] as const).map((role) => (
        <RoleSection key={role} role={role} data={data} sales={sales} onChange={load} />
      ))}
    </div>
  );
}

// ───────────────────────── Cálculo de renglones ─────────────────────────

type Totals = { receipts: number; receiptsOffer: number; normal: number; offer: number };

type PriceRow = {
  key: string;
  plan: AdminPlan;
  cycle: BillingInterval;
  /** Quién ve este precio: "A y B", "Solo A", "Todos". */
  who: string;
  perStudent: boolean;
  normal: number;
  /** Precio con la oferta en curso; null si no hay. */
  today: { price: number; label: string } | null;
  totals: Totals;
};

const EMPTY: Totals = { receipts: 0, receiptsOffer: 0, normal: 0, offer: 0 };

const sumSales = (rows: PlanSales[]): Totals =>
  rows.reduce(
    (t, s) => ({
      receipts: t.receipts + Number(s.receipts),
      receiptsOffer: t.receiptsOffer + Number(s.receipts_offer),
      normal: t.normal + Number(s.revenue_normal),
      offer: t.offer + Number(s.revenue_offer),
    }),
    EMPTY
  );

function saleState(s: AdminFlashSale, now: number) {
  if (new Date(s.expires_at).getTime() < now) return { key: "ended", label: "Terminada", className: "bg-muted text-cool" } as const;
  if (!s.is_active) return { key: "paused", label: "Pausada", className: "bg-muted text-cool" } as const;
  if (new Date(s.starts_at).getTime() > now) return { key: "scheduled", label: "Programada", className: "bg-primary/15 text-brand-light" } as const;
  return { key: "live", label: "En curso", className: "bg-success/15 text-success" } as const;
}

/** La oferta que hoy aplica a un plan y periodo: primero la de precio fijo de ese plan, luego el mayor porcentaje. */
function liveSaleFor(sales: AdminFlashSale[], planId: string, cycle: BillingInterval, now: number) {
  const live = sales.filter((s) => saleState(s, now).key === "live");
  const fixed = live.find((s) => s.discount_pct == null && s.plan_id === planId && s.billing_cycle === cycle);
  if (fixed) return fixed;
  return (
    live
      .filter((s) => s.discount_pct != null && (s.plan_id == null || s.plan_id === planId))
      .sort((a, b) => Number(b.discount_pct) - Number(a.discount_pct))[0] ?? null
  );
}

function todayPrice(sales: AdminFlashSale[], planId: string, cycle: BillingInterval, normal: number, now: number) {
  const sale = liveSaleFor(sales, planId, cycle, now);
  if (!sale) return null;
  if (sale.discount_pct != null) {
    return { price: discounted(normal, Number(sale.discount_pct)), label: `−${Math.round(Number(sale.discount_pct))} %` };
  }
  return { price: Number(sale.discounted_price), label: "Precio fijo" };
}

const activeExperiment = (data: PricingAdmin, role: PricingRole) =>
  data.experiments.find((e) => e.target_role === role && e.status === "active") ?? null;

const isPerStudent = (p: AdminPlan) => p.max_students > p.min_students && p.extra_student_price_monthly > 0;

/** Precio que una variante del A/B define para un plan y periodo (null: no lo cambia). */
function variantPrice(exp: AdminExperiment, v: Variant, planId: string, cycle: BillingInterval) {
  const o = (v === "variant_a" ? exp.variant_a_config : exp.variant_b_config).offers.find(
    (x) => x.plan_id === planId && x.interval === cycle
  );
  return o ? Number(o.price) : null;
}

/** Precio normal por unidad (por estudiante en Familia), igual que `stripe_cotizar`. */
function basePrice(p: AdminPlan, cycle: BillingInterval) {
  const annual = Number(p.base_price_annual ?? Number(p.base_price_monthly) * 12);
  if (isPerStudent(p)) return Math.round(cycle === "annual" ? annual / p.min_students : Number(p.extra_student_price_monthly));
  return Math.round(cycle === "annual" ? annual : Number(p.base_price_monthly));
}

function rowsFor(role: PricingRole, data: PricingAdmin, sales: PlanSales[], now: number): PriceRow[] {
  const plans = data.plans.filter((p) => p.target_role === role).sort((a, b) => a.sort_order - b.sort_order);
  const roleSales = data.flash_sales.filter((s) => s.target_role === role);
  const exp = activeExperiment(data, role);

  if (exp && role === "parent") {
    // Padres: todos los planes y periodos; el A/B solo cambia los precios que define. Si A y B pagan lo mismo, un renglón.
    return plans.flatMap((plan) =>
      PARENT_CYCLES.flatMap((cycle) => {
        const base = basePrice(plan, cycle);
        const prices = VARIANTS.map((v) => variantPrice(exp, v, plan.id, cycle) ?? base);
        const groups: { variants: Variant[]; price: number }[] =
          prices[0] === prices[1]
            ? [{ variants: VARIANTS, price: prices[0] }]
            : VARIANTS.map((v, i) => ({ variants: [v], price: prices[i] }));
        return groups.map(({ variants, price }) => {
          const both = variants.length === 2;
          return {
            key: `${plan.id}:${cycle}:${variants.join("+")}`,
            plan,
            cycle,
            who: both ? "A y B" : `Solo ${variants[0] === "variant_a" ? "A" : "B"}`,
            perStudent: isPerStudent(plan),
            normal: price,
            today: todayPrice(roleSales, plan.id, cycle, price, now),
            totals: sumSales(
              sales.filter(
                (s) => s.plan_id === plan.id && s.billing_cycle === cycle && (s.variant ? variants.includes(s.variant) : both)
              )
            ),
          };
        });
      })
    );
  }

  if (exp) {
    // Un renglón por precio real: si A y B ven el mismo plan, periodo y precio, se juntan.
    const byKey = new Map<string, { planId: string; cycle: BillingInterval; price: number; variants: Variant[] }>();
    for (const v of VARIANTS) {
      const config = v === "variant_a" ? exp.variant_a_config : exp.variant_b_config;
      for (const o of config.offers) {
        const key = `${o.plan_id}:${o.interval}:${o.price}`;
        const row = byKey.get(key) ?? { planId: o.plan_id, cycle: o.interval, price: Number(o.price), variants: [] };
        row.variants.push(v);
        byKey.set(key, row);
      }
    }
    return [...byKey.entries()]
      .filter(([, r]) => plans.some((p) => p.id === r.planId))
      .sort(([, a], [, b]) => INTERVAL_MONTHS[a.cycle] - INTERVAL_MONTHS[b.cycle])
      .map(([key, r]) => {
        const plan = plans.find((p) => p.id === r.planId)!;
        const both = r.variants.length === 2;
        return {
          key,
          plan,
          cycle: r.cycle,
          who: both ? "A y B" : `Solo ${r.variants[0] === "variant_a" ? "A" : "B"}`,
          perStudent: false,
          normal: r.price,
          today: todayPrice(roleSales, plan.id, r.cycle, r.price, now),
          totals: sumSales(
            sales.filter(
              (s) =>
                s.plan_id === plan.id &&
                s.billing_cycle === r.cycle &&
                (s.variant ? r.variants.includes(s.variant) : both)
            )
          ),
        };
      });
  }

  return plans.flatMap((plan) =>
    (["monthly", "annual"] as const).map((cycle) => {
      const normal = basePrice(plan, cycle);
      return {
        key: `${plan.id}:${cycle}`,
        plan,
        cycle,
        who: "Todos",
        perStudent: isPerStudent(plan),
        normal,
        today: todayPrice(roleSales, plan.id, cycle, normal, now),
        totals: sumSales(sales.filter((s) => s.plan_id === plan.id && s.billing_cycle === cycle)),
      };
    })
  );
}

// ───────────────────────── Bloque por rol ─────────────────────────

type DialogState =
  | { kind: "offer"; sale: AdminFlashSale | null }
  | { kind: "plan"; plan: AdminPlan }
  /** experiment null: primer A/B del rol (se arma desde los precios base). */
  | { kind: "experiment"; experiment: AdminExperiment | null; asNew: boolean }
  | null;

function RoleSection({
  role,
  data,
  sales,
  onChange,
}: {
  role: PricingRole;
  data: PricingAdmin;
  sales: PlanSales[];
  onChange: () => void;
}) {
  const now = Date.now();
  const [dialog, setDialog] = React.useState<DialogState>(null);
  const plans = data.plans.filter((p) => p.target_role === role).sort((a, b) => a.sort_order - b.sort_order);
  const rows = rowsFor(role, data, sales, now);
  // Lo vendido de planes que ya no tienen renglón (p. ej. un periodo que salió del A/B) también cuenta en el total.
  const total = sumSales(sales.filter((s) => plans.some((p) => p.id === s.plan_id)));
  const exp = activeExperiment(data, role);
  const latestExp = data.experiments.find((e) => e.target_role === role) ?? null;
  const roleSales = data.flash_sales.filter((s) => s.target_role === role);
  const current = roleSales.filter((s) => saleState(s, now).key !== "ended");
  const ended = roleSales.filter((s) => saleState(s, now).key === "ended");
  const close = () => setDialog(null);
  const saved = () => {
    setDialog(null);
    onChange();
  };

  return (
    <section aria-labelledby={`role-${role}`} className="flex flex-col gap-4 rounded-2xl border bg-card p-4 sm:p-5">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 id={`role-${role}`} className="text-xl font-bold">
            {SECTION[role].title}
          </h2>
          <p className="text-sm text-muted-foreground">{(exp && SECTION[role].subtitleAb) || SECTION[role].subtitle}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="brand" onClick={() => setDialog({ kind: "offer", sale: null })}>
            <Zap /> Aplicar oferta
          </Button>
          <Button
            variant="outline"
            // Estudiantes: el nuevo parte del último A/B. Padres: también puede ser el primero.
            disabled={role === "student" && !latestExp}
            onClick={() => setDialog({ kind: "experiment", experiment: exp ?? latestExp, asNew: true })}
          >
            <FlaskConical /> Nuevo A/B test
          </Button>
        </div>
      </header>

      <Offers sales={current} ended={ended} plans={plans} now={now} onEdit={(s) => setDialog({ kind: "offer", sale: s })} onChange={onChange} />

      <p className="flex flex-wrap items-center gap-2 text-sm">
        <FlaskConical className="size-4 text-brand-light" aria-hidden />
        {exp ? (
          <>
            <span>
              A/B en curso: <span className="font-semibold">{exp.experiment_name}</span>
            </span>
            <Button size="sm" variant="ghost" onClick={() => setDialog({ kind: "experiment", experiment: exp, asNew: false })}>
              <Pencil /> Editar precios A/B
            </Button>
          </>
        ) : (
          <span className="text-muted-foreground">
            Sin A/B en curso: todos ven el precio base {role === "student" ? "del plan" : "de cada plan"}.
            {latestExp && " Actívalo en Funnel y A/B."}
          </span>
        )}
      </p>

      <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <table className="w-full min-w-[46rem] text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-muted-foreground">
              <th className="py-2 pr-3 font-medium">Plan y periodo</th>
              {exp && <th className="px-3 py-2 font-medium">Lo ve</th>}
              <th className="px-3 py-2 text-right font-medium">Precio normal</th>
              <th className="px-3 py-2 text-right font-medium">Paga hoy</th>
              <th className="px-3 py-2 text-right font-medium">Ventas</th>
              <th className="px-3 py-2 text-right font-medium">Ingreso normal</th>
              <th className="px-3 py-2 text-right font-medium">Ingreso con oferta</th>
              <th className="px-3 py-2 text-right font-medium">Total</th>
              <th className="py-2 pl-3">
                <span className="sr-only">Acciones</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key} className="border-b border-border/60 last:border-0">
                <td className="py-3 pr-3">
                  <span className="font-semibold">{r.plan.name}</span>
                  <span className="text-muted-foreground"> · {INTERVAL_LABEL[r.cycle].name}</span>
                  {!r.plan.is_active && <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs text-cool">Oculto</span>}
                  {r.perStudent && (
                    <span className="block text-xs text-muted-foreground">
                      Por estudiante, de {r.plan.min_students} a {r.plan.max_students}
                    </span>
                  )}
                </td>
                {exp && (
                  <td className="px-3 py-3">
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold">{r.who}</span>
                  </td>
                )}
                <td className={cn("px-3 py-3 text-right tabular-nums", r.today && "text-muted-foreground line-through")}>
                  {formatMxn(r.normal)}
                </td>
                <td className="px-3 py-3 text-right tabular-nums">
                  {r.today ? (
                    <>
                      <span className="font-bold text-success">{formatMxn(r.today.price)}</span>
                      <span className="block text-xs text-muted-foreground">{r.today.label}</span>
                    </>
                  ) : (
                    <span className="font-bold">{formatMxn(r.normal)}</span>
                  )}
                </td>
                <SalesCells totals={r.totals} />
                <td className="py-3 pl-3 text-right">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      setDialog(exp ? { kind: "experiment", experiment: exp, asNew: false } : { kind: "plan", plan: r.plan })
                    }
                  >
                    <Pencil /> Editar
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t text-sm">
              <td className="py-3 pr-3 font-semibold" colSpan={exp ? 4 : 3}>
                Total {SECTION[role].title}
              </td>
              <SalesCells totals={total} strong />
              <td />
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t pt-3 text-sm">
        <span className="text-muted-foreground">Textos de las tarjetas:</span>
        {plans.map((p) => (
          <Button key={p.id} size="sm" variant="outline" onClick={() => setDialog({ kind: "plan", plan: p })}>
            <Pencil /> {p.name}
          </Button>
        ))}
      </div>

      <Dialog open={dialog !== null} onOpenChange={(open) => !open && close()}>
        {dialog?.kind === "offer" && <OfferDialog role={role} plans={plans} sale={dialog.sale} onSaved={saved} />}
        {dialog?.kind === "plan" && <PlanDialog plan={dialog.plan} experimentActive={!!exp} onSaved={saved} />}
        {dialog?.kind === "experiment" && (
          <ExperimentDialog role={role} experiment={dialog.experiment} asNew={dialog.asNew} plans={plans} onSaved={saved} />
        )}
      </Dialog>
    </section>
  );
}

function SalesCells({ totals: t, strong }: { totals: Totals; strong?: boolean }) {
  const cell = cn("px-3 py-3 text-right tabular-nums", strong && "font-bold");
  return (
    <>
      <td className={cell}>
        {t.receipts.toLocaleString("es-MX")}
        {t.receiptsOffer > 0 && <span className="block text-xs font-normal text-muted-foreground">{t.receiptsOffer} con oferta</span>}
      </td>
      <td className={cell}>{formatMxn(t.normal)}</td>
      <td className={cell}>{formatMxn(t.offer)}</td>
      <td className={cn(cell, "font-bold")}>{formatMxn(t.normal + t.offer)}</td>
    </>
  );
}

// ───────────────────────── Ofertas ─────────────────────────

function saleScope(s: AdminFlashSale, plans: AdminPlan[]) {
  const plan = s.plan_id ? (plans.find((p) => p.id === s.plan_id)?.name ?? s.plan_id) : "Todos los planes";
  if (s.discount_pct != null) return `${plan} · −${Math.round(Number(s.discount_pct))} %`;
  return `${plan} · ${INTERVAL_LABEL[s.billing_cycle].name} a ${formatMxn(Number(s.discounted_price))}`;
}

function Offers({
  sales,
  ended,
  plans,
  now,
  onEdit,
  onChange,
}: {
  sales: AdminFlashSale[];
  ended: AdminFlashSale[];
  plans: AdminPlan[];
  now: number;
  onEdit: (s: AdminFlashSale) => void;
  onChange: () => void;
}) {
  const [error, setError] = React.useState<string | null>(null);

  const toggle = async (s: AdminFlashSale) => {
    setError(null);
    try {
      await setFlashSaleActive(s.id, !s.is_active);
      onChange();
    } catch (err) {
      setError(errorText(err, "No pudimos cambiar la oferta."));
    }
  };

  return (
    <div className="flex flex-col gap-2">
      {sales.length === 0 ? (
        <p className="rounded-xl border border-dashed px-4 py-3 text-sm text-muted-foreground">
          Sin oferta: todos pagan el precio normal.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {sales.map((s) => {
            const st = saleState(s, now);
            return (
              <li
                key={s.id}
                className={cn(
                  "flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3 text-sm",
                  st.key === "live" ? "border-energy/40 bg-energy/5" : "bg-muted/30"
                )}
              >
                <Zap className={cn("size-4 shrink-0", st.key === "live" ? "text-energy" : "text-muted-foreground")} aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{saleScope(s, plans)}</span>
                    <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", st.className)}>{st.label}</span>
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {s.title} · {formatDateTime(s.starts_at)} → {formatDateTime(s.expires_at)}
                    {s.duration_days && ` · licencia de ${s.duration_days} días`}
                  </span>
                </span>
                <span className="flex gap-1">
                  <Button size="sm" variant="ghost" onClick={() => onEdit(s)}>
                    <Pencil /> Editar
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => void toggle(s)}>
                    {s.is_active ? <Pause /> : <Play />} {s.is_active ? "Pausar" : "Reanudar"}
                  </Button>
                </span>
              </li>
            );
          })}
        </ul>
      )}
      {error && <ErrorLine text={error} />}
      {ended.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer text-muted-foreground">Ofertas terminadas ({ended.length})</summary>
          <ul className="mt-2 flex flex-col gap-1 pl-4 text-xs text-muted-foreground">
            {ended.map((s) => (
              <li key={s.id}>
                {saleScope(s, plans)} · {s.title} · {formatDateTime(s.starts_at)} → {formatDateTime(s.expires_at)}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

const toLocalInput = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);

function OfferDialog({
  role,
  plans,
  sale,
  onSaved,
}: {
  role: PricingRole;
  plans: AdminPlan[];
  sale: AdminFlashSale | null;
  onSaved: () => void;
}) {
  const [form, setForm] = React.useState(() => ({
    kind: (sale && sale.discount_pct == null ? "fixed" : "pct") as "pct" | "fixed",
    title: sale?.title ?? "",
    planId: sale?.plan_id ?? "",
    cycle: sale?.billing_cycle ?? ("monthly" as BillingInterval),
    price: sale?.discounted_price != null ? String(sale.discounted_price) : "",
    pct: sale?.discount_pct != null ? String(Math.round(Number(sale.discount_pct))) : "40",
    durationDays: sale?.duration_days ? String(sale.duration_days) : "",
    startsAt: toLocalInput(sale ? new Date(sale.starts_at) : new Date()),
    expiresAt: toLocalInput(sale ? new Date(sale.expires_at) : new Date(Date.now() + 3 * 86_400_000)),
  }));
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const fixed = form.kind === "fixed";
  const cycles: BillingInterval[] = role === "student" ? CYCLES : ["monthly", "annual"];
  const plan = plans.find((p) => p.id === form.planId);

  // Vista previa: cómo quedan los precios base con este descuento.
  const preview =
    !fixed && Number(form.pct) > 0 && Number(form.pct) < 100
      ? plans
          .filter((p) => !form.planId || p.id === form.planId)
          .flatMap((p) =>
            (["monthly", "annual"] as const).map((c) => {
              const normal = basePrice(p, c);
              return `${p.name} ${INTERVAL_LABEL[c].name.toLowerCase()}: ${formatMxn(normal)} → ${formatMxn(discounted(normal, Number(form.pct)))}${isPerStudent(p) ? " por estudiante" : ""}`;
            })
          )
      : [];

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await saveFlashSale({
        id: sale?.id ?? null,
        title: form.title.trim() || (fixed ? "Oferta" : `${form.pct} % de descuento`),
        role,
        planId: form.planId || null,
        cycle: form.cycle,
        price: fixed ? Number(form.price) : null,
        pct: fixed ? null : Number(form.pct),
        durationDays: form.durationDays ? Number(form.durationDays) : null,
        startsAt: new Date(form.startsAt).toISOString(),
        expiresAt: new Date(form.expiresAt).toISOString(),
        active: sale?.is_active ?? true,
      });
      onSaved();
    } catch (err) {
      setError(errorText(err, "No pudimos guardar la oferta."));
      setBusy(false);
    }
  };

  return (
    <DialogContent className="sm:max-w-xl">
      <DialogHeader>
        <DialogTitle>{sale ? "Editar oferta" : `Aplicar oferta · ${SECTION[role].title}`}</DialogTitle>
        <DialogDescription>
          Sale como banner sobre los planes mientras está en curso. No cambia la variante A/B de nadie: al terminar, cada quien
          vuelve a ver su precio normal.
        </DialogDescription>
      </DialogHeader>
      <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
        <Field label="Tipo de oferta">
          <NativeSelect value={form.kind} onChange={(e) => setForm((f) => ({ ...f, kind: e.target.value as "pct" | "fixed", planId: "" }))}>
            <option value="pct">% de descuento</option>
            <option value="fixed">Precio fijo de un plan</option>
          </NativeSelect>
        </Field>
        <Field label="Aplica a">
          <NativeSelect value={form.planId} onChange={(e) => set("planId", e.target.value)} required={fixed}>
            {fixed ? <option value="">Elige un plan…</option> : <option value="">Todos los planes</option>}
            {plans.map((p) => (
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
                {cycles.map((c) => (
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
                placeholder={plan ? `Normal ${formatMxn(basePrice(plan, form.cycle))}` : undefined}
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
        <Field label="Nombre (para el banner)" className={fixed ? "sm:col-span-2" : undefined}>
          <Input value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="Ej. 40 % hasta el 20 de diciembre" className="h-11" />
        </Field>
        <Field label="Empieza">
          <Input type="datetime-local" value={form.startsAt} onChange={(e) => set("startsAt", e.target.value)} className="h-11" required />
        </Field>
        <Field label="Termina">
          <Input type="datetime-local" value={form.expiresAt} onChange={(e) => set("expiresAt", e.target.value)} className="h-11" required />
        </Field>
        <Field label="Días de licencia (opcional)" className="sm:col-span-2">
          <Input
            type="number"
            min={1}
            value={form.durationDays}
            onChange={(e) => set("durationDays", e.target.value)}
            placeholder="Vacío = los días del periodo que compre"
            className="h-11"
          />
        </Field>
        {preview.length > 0 && (
          <div className="rounded-xl bg-muted/40 p-3 text-xs text-muted-foreground sm:col-span-2">
            <p className="mb-1 font-semibold text-foreground">Así quedan los precios</p>
            <ul className="flex flex-col gap-0.5">
              {preview.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
            <p className="mt-1">Con A/B en curso, el descuento se aplica al precio de la variante de cada quien.</p>
          </div>
        )}
        <div className="flex flex-col gap-2 sm:col-span-2">
          {error && <ErrorLine text={error} />}
          <Button type="submit" variant="brand" className="h-11 sm:w-fit" disabled={busy}>
            {busy ? <Loader2 className="animate-spin motion-reduce:animate-none" /> : sale ? <Save /> : <Zap />}
            {sale ? "Guardar oferta" : "Aplicar oferta"}
          </Button>
        </div>
      </form>
    </DialogContent>
  );
}

// ───────────────────────── Plan ─────────────────────────

function PlanDialog({ plan, experimentActive, onSaved }: { plan: AdminPlan; experimentActive: boolean; onSaved: () => void }) {
  const [p, setP] = React.useState(plan);
  const [features, setFeatures] = React.useState(plan.features.join("\n"));
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const set = <K extends keyof AdminPlan>(k: K, v: AdminPlan[K]) => setP((x) => ({ ...x, [k]: v }));
  const perStudent = isPerStudent(p);
  const abNote = experimentActive;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await savePlan({ ...p, features: features.split("\n").map((f) => f.trim()).filter(Boolean) });
      onSaved();
    } catch (err) {
      setError(errorText(err, "No pudimos guardar el plan."));
      setBusy(false);
    }
  };

  return (
    <DialogContent className="sm:max-w-xl">
      <DialogHeader>
        <DialogTitle>Editar {plan.name}</DialogTitle>
        <DialogDescription>Precio normal y textos de la tarjeta. Las ofertas se aplican aparte.</DialogDescription>
      </DialogHeader>
      <form onSubmit={save} className="flex flex-col gap-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={perStudent ? `Mensual por estudiante (MXN)` : "Mensual (MXN)"}>
            <Input
              type="number"
              min={0}
              value={perStudent ? p.extra_student_price_monthly : p.base_price_monthly}
              onChange={(e) =>
                perStudent
                  ? setP((x) => ({
                      ...x,
                      extra_student_price_monthly: Number(e.target.value),
                      base_price_monthly: Number(e.target.value) * x.min_students,
                    }))
                  : set("base_price_monthly", Number(e.target.value))
              }
              className="h-11"
            />
          </Field>
          <Field label={perStudent ? `Anual por estudiante (MXN)` : "Anual (MXN)"}>
            <Input
              type="number"
              min={0}
              value={
                p.base_price_annual == null ? "" : perStudent ? Math.round(Number(p.base_price_annual) / p.min_students) : p.base_price_annual
              }
              onChange={(e) =>
                set(
                  "base_price_annual",
                  e.target.value === "" ? null : Number(e.target.value) * (perStudent ? p.min_students : 1)
                )
              }
              className="h-11"
            />
          </Field>
        </div>
        {abNote && (
          <p className="rounded-xl bg-muted/40 p-3 text-xs text-muted-foreground">
            {plan.target_role === "student"
              ? "Hay un A/B en curso: los estudiantes ven los precios de su variante, no estos. Estos se usan cuando no hay A/B."
              : "Hay un A/B en curso: donde el A/B define precio para este plan, los padres ven el de su variante; en lo demás, estos."}
          </p>
        )}
        {perStudent && (
          <p className="text-xs text-muted-foreground">
            De {p.min_students} a {p.max_students} estudiantes; el total es el precio por estudiante × estudiantes.
          </p>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Nombre">
            <Input value={p.name} onChange={(e) => set("name", e.target.value)} className="h-11" required />
          </Field>
          <Field label="Etiqueta destacada">
            <Input value={p.badge ?? ""} onChange={(e) => set("badge", e.target.value)} placeholder="Ej. Plan más popular" className="h-11" />
          </Field>
        </div>
        <Field label="Descripción">
          <Input value={p.description ?? ""} onChange={(e) => set("description", e.target.value)} className="h-11" />
        </Field>
        <Field label="Beneficios (uno por renglón)">
          <Textarea value={features} onChange={(e) => setFeatures(e.target.value)} rows={4} />
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={p.is_active} onChange={(e) => set("is_active", e.target.checked)} className="size-4 accent-[var(--secondary)]" />
          Se muestra y se puede comprar
        </label>
        {error && <ErrorLine text={error} />}
        <Button type="submit" variant="brand" className="h-11 sm:w-fit" disabled={busy}>
          {busy ? <Loader2 className="animate-spin motion-reduce:animate-none" /> : <Save />} Guardar plan
        </Button>
      </form>
    </DialogContent>
  );
}

// ───────────────────────── A/B ─────────────────────────

function ExperimentDialog({
  role,
  experiment,
  asNew,
  plans,
  onSaved,
}: {
  role: PricingRole;
  experiment: AdminExperiment | null;
  asNew: boolean;
  plans: AdminPlan[];
  onSaved: () => void;
}) {
  const parent = role === "parent";
  // Padres: cada renglón es plan + periodo (mensual o anual). Estudiantes: un solo plan, cualquier periodo.
  const slots = parent ? plans.flatMap((p) => PARENT_CYCLES.map((cycle) => ({ plan: p, cycle }))) : [];
  const maxOffers = parent ? slots.length : CYCLES.length;
  const firstConfig = (): VariantConfig => {
    const p = plans[0];
    return { offers: p ? [{ plan_id: p.id, interval: "monthly", price: basePrice(p, "monthly") }] : [] };
  };
  const [name, setName] = React.useState(asNew || !experiment ? "" : experiment.experiment_name);
  const [configs, setConfigs] = React.useState<Record<Variant, VariantConfig>>({
    variant_a: experiment?.variant_a_config ?? firstConfig(),
    variant_b: experiment?.variant_b_config ?? firstConfig(),
  });
  const [activate, setActivate] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const planId = plans[0]?.id ?? "student";
  const planOf = (id: string) => plans.find((p) => p.id === id);

  const setOffers = (v: Variant, fn: (offers: VariantConfig["offers"]) => VariantConfig["offers"]) =>
    setConfigs((c) => ({ ...c, [v]: { ...c[v], offers: fn(c[v].offers) } }));

  /** Siguiente periodo (o plan + periodo, en padres) que la variante aún no tiene, con su precio base. */
  const nextOffer = (offers: VariantConfig["offers"]): OfferConfig => {
    if (parent) {
      const free = slots.find((s) => !offers.some((o) => o.plan_id === s.plan.id && o.interval === s.cycle)) ?? slots[0];
      return { plan_id: free.plan.id, interval: free.cycle, price: basePrice(free.plan, free.cycle) };
    }
    return { plan_id: planId, interval: CYCLES.find((c) => !offers.some((x) => x.interval === c)) ?? "monthly", price: 0 };
  };

  const repeated = VARIANTS.some((v) => {
    const keys = configs[v].offers.map((o) => `${o.plan_id}:${o.interval}`);
    return new Set(keys).size !== keys.length;
  });

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (repeated) {
      setError(parent ? "Cada plan y periodo va una sola vez por variante." : "Cada periodo va una sola vez por variante.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const id = await saveExperiment({
        id: asNew || !experiment ? null : experiment.id,
        name: name.trim() || "A/B de precios",
        role,
        a: configs.variant_a,
        b: configs.variant_b,
      });
      if (asNew && activate) await setExperimentStatus(id, "active");
      onSaved();
    } catch (err) {
      setError(errorText(err, "No pudimos guardar el A/B."));
      setBusy(false);
    }
  };

  return (
    <DialogContent className="sm:max-w-2xl">
      <DialogHeader>
        <DialogTitle>{asNew ? `Nuevo A/B test · ${SECTION[role].title}` : "Editar precios A/B"}</DialogTitle>
        <DialogDescription>
          {!asNew
            ? "Cambiar precios de un A/B que ya corre mezcla sus métricas. Para comparar precios nuevos, mejor crea un A/B nuevo."
            : parent
              ? "Elige qué plan, periodo y precio ve cada variante. Lo que no pongas se cobra al precio base. Cada padre o tutor conserva para siempre la variante que le tocó."
              : "Define qué periodos y precios ve cada variante. Cada estudiante conserva para siempre la variante que le tocó."}
        </DialogDescription>
      </DialogHeader>
      <form onSubmit={save} className="flex flex-col gap-3">
        <Field label="Nombre del A/B">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={parent ? "Ej. Plan Tutor $105 vs $119" : "Ej. Mensual vs Trimestral"}
            className="h-11"
            required
          />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          {VARIANTS.map((v) => (
            <div key={v} className="flex min-w-0 flex-col gap-2 rounded-xl bg-muted/40 p-3">
              <p className="font-semibold">{VARIANT_LABEL[v]}</p>
              {configs[v].offers.map((o, i) => {
                const plan = planOf(o.plan_id);
                const update = (patch: Partial<OfferConfig>) =>
                  setOffers(v, (offers) => offers.map((x, j) => (j === i ? { ...x, ...patch } : x)));
                return (
                  <div key={i} className="flex flex-col gap-1">
                    {parent && (
                      <NativeSelect
                        value={o.plan_id}
                        onChange={(e) => {
                          const p = planOf(e.target.value);
                          update({ plan_id: e.target.value, ...(p && { price: basePrice(p, o.interval) }) });
                        }}
                        aria-label="Plan"
                        className="h-10"
                      >
                        {plans.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </NativeSelect>
                    )}
                    <div className="grid grid-cols-[1fr_6rem_auto] gap-2">
                      <NativeSelect
                        value={o.interval}
                        onChange={(e) => {
                          const cycle = e.target.value as BillingInterval;
                          update({ interval: cycle, ...(parent && plan && { price: basePrice(plan, cycle) }) });
                        }}
                        aria-label="Periodo"
                        className="h-10"
                      >
                        {(parent ? PARENT_CYCLES : CYCLES).map((c) => (
                          <option key={c} value={c}>
                            {INTERVAL_LABEL[c].name}
                          </option>
                        ))}
                      </NativeSelect>
                      <Input
                        type="number"
                        min={0}
                        value={o.price}
                        onChange={(e) => update({ price: Number(e.target.value) })}
                        aria-label={plan && isPerStudent(plan) ? "Precio MXN por estudiante" : "Precio MXN"}
                        className="h-10"
                      />
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        aria-label="Quitar"
                        disabled={configs[v].offers.length <= 1}
                        onClick={() => setOffers(v, (offers) => offers.filter((_, j) => j !== i))}
                      >
                        <Minus />
                      </Button>
                    </div>
                    {parent && plan && (
                      <p className="mb-1 text-xs text-muted-foreground">
                        {isPerStudent(plan) ? "Por estudiante · " : ""}base {formatMxn(basePrice(plan, o.interval))}
                      </p>
                    )}
                  </div>
                );
              })}
              {configs[v].offers.length < maxOffers && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="w-fit"
                  onClick={() => setOffers(v, (offers) => [...offers, nextOffer(offers)])}
                >
                  <Plus /> {parent ? "Agregar precio" : "Agregar periodo"}
                </Button>
              )}
            </div>
          ))}
        </div>
        {asNew && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={activate} onChange={(e) => setActivate(e.target.checked)} className="size-4 accent-[var(--secondary)]" />
            {experiment ? "Activarlo ya (el A/B actual se pausa y conserva sus métricas)" : "Activarlo ya"}
          </label>
        )}
        {error && <ErrorLine text={error} />}
        <Button type="submit" variant="brand" className="h-11 sm:w-fit" disabled={busy}>
          {busy ? <Loader2 className="animate-spin motion-reduce:animate-none" /> : asNew ? <FlaskConical /> : <Save />}
          {asNew ? "Crear A/B" : "Guardar precios"}
        </Button>
      </form>
    </DialogContent>
  );
}

// ───────────────────────── Comunes ─────────────────────────

function Field({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <label className={cn("flex min-w-0 flex-col gap-1.5 text-sm", className)}>
      <span className="text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
