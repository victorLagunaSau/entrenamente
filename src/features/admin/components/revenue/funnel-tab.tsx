"use client";

import * as React from "react";
import { Pause, Play, RefreshCw, Square, Trophy } from "lucide-react";

import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/features/admin/ingest/components/fields";
import {
  type AbMetrics,
  type AdminExperiment,
  type ExperimentStatus,
  getAbMetrics,
  getPricingAdmin,
  pct,
  rate,
  setExperimentStatus,
  type VariantMetrics,
  winnerOf,
} from "@/features/admin/services/revenue-service";
import { formatMxn, INTERVAL_LABEL, VARIANT_LABEL, type VariantConfig } from "@/features/pricing/lib/pricing";
import { cn } from "@/lib/utils";

import { ErrorLine, errorText, formatDay, useIncludeTests } from "./revenue-workspace";

const STATUS: Record<ExperimentStatus, { label: string; className: string }> = {
  active: { label: "Activo", className: "bg-success/15 text-success" },
  paused: { label: "Pausado", className: "bg-gold/15 text-gold" },
  finished: { label: "Finalizado", className: "bg-muted text-cool" },
};

/** Pestaña 1: comparativo cara a cara de la Variante A vs la B, con su embudo y la ganadora. */
export function FunnelTab() {
  const [experiments, setExperiments] = React.useState<AdminExperiment[] | null>(null);
  const [selected, setSelected] = React.useState<string | null>(null);
  const [metrics, setMetrics] = React.useState<AbMetrics | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  const includeTests = useIncludeTests();
  const load = React.useCallback(async (id: string | null) => {
    setBusy(true);
    setError(null);
    try {
      const [admin, m] = await Promise.all([getPricingAdmin(), getAbMetrics(id, includeTests)]);
      setExperiments(admin.experiments);
      setMetrics(m);
      setSelected(m.experiment?.id ?? null);
    } catch (e) {
      setError(errorText(e, "No pudimos cargar las métricas."));
    } finally {
      setBusy(false);
    }
  }, [includeTests]);

  // Al cambiar "Incluir pruebas" recarga el experimento que se está viendo.
  const selectedRef = React.useRef(selected);
  selectedRef.current = selected;
  React.useEffect(() => {
    void load(selectedRef.current);
  }, [load]);

  const changeStatus = async (status: ExperimentStatus) => {
    if (!selected) return;
    setBusy(true);
    try {
      await setExperimentStatus(selected, status);
      await load(selected);
    } catch (e) {
      setError(errorText(e, "No pudimos cambiar el estado."));
      setBusy(false);
    }
  };

  if (!experiments && !error) return <div className="h-80 animate-pulse rounded-2xl bg-card motion-reduce:animate-none" />;

  const exp = metrics?.experiment ?? null;
  const winner = metrics ? winnerOf(metrics.variants) : null;

  return (
    <div className="flex flex-col gap-5">
      {error && <ErrorLine text={error} />}

      <div className="flex flex-col gap-3 rounded-2xl border bg-card p-4 sm:flex-row sm:items-end">
        <label className="flex min-w-0 flex-1 flex-col gap-1.5 text-sm">
          <span className="text-muted-foreground">Experimento</span>
          <NativeSelect value={selected ?? ""} onChange={(e) => void load(e.target.value || null)} disabled={busy}>
            {experiments?.map((e) => (
              <option key={e.id} value={e.id}>
                {e.experiment_name} · {STATUS[e.status].label}
              </option>
            ))}
          </NativeSelect>
        </label>
        {exp && (
          <div className="flex flex-wrap gap-2">
            {exp.status !== "active" && (
              <Button variant="brand" onClick={() => void changeStatus("active")} disabled={busy}>
                <Play /> Activar
              </Button>
            )}
            {exp.status === "active" && (
              <Button variant="outline" onClick={() => void changeStatus("paused")} disabled={busy}>
                <Pause /> Pausar
              </Button>
            )}
            {exp.status !== "finished" && (
              <Button variant="ghost" onClick={() => void changeStatus("finished")} disabled={busy}>
                <Square /> Finalizar
              </Button>
            )}
            <Button variant="ghost" size="icon" aria-label="Actualizar" onClick={() => void load(selected)} disabled={busy}>
              <RefreshCw className={cn(busy && "animate-spin motion-reduce:animate-none")} />
            </Button>
          </div>
        )}
      </div>

      {!exp || !metrics ? (
        <p className="rounded-2xl border bg-card p-5 text-sm text-muted-foreground">Aún no hay experimentos.</p>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            <span className={cn("mr-2 rounded-full px-2.5 py-0.5 text-xs font-semibold", STATUS[exp.status].className)}>
              {STATUS[exp.status].label}
            </span>
            {exp.target_role === "student" ? "Estudiantes" : "Padres y tutores"} · desde {formatDay(exp.created_at)}
            {metrics.assigned &&
              ` · Usuarios con variante: A ${metrics.assigned.variant_a.toLocaleString("es-MX")} · B ${metrics.assigned.variant_b.toLocaleString("es-MX")}`}
          </p>
          <div className="grid gap-4 lg:grid-cols-2">
            {metrics.variants.map((v) => (
              <VariantCard
                key={v.variant}
                metrics={v}
                config={v.variant === "variant_a" ? exp.variant_a_config : exp.variant_b_config}
                winner={winner?.variant === v.variant ? winner.reason : null}
              />
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Ganadora: mayor ingreso por visitante; mientras no haya recibos, mayor tasa de intención (clics ÷ impresiones).
            &ldquo;Con oferta&rdquo; = había una oferta en curso cuando se tocó el plan o se pagó. Las ofertas no cambian la
            variante de nadie.
          </p>
        </>
      )}
    </div>
  );
}

function VariantCard({ metrics: m, config, winner }: { metrics: VariantMetrics; config: VariantConfig; winner: string | null }) {
  const base = Math.max(m.impressions, 1);
  const steps = [
    { label: "Impresiones", value: m.impressions, note: `${m.visitors.toLocaleString("es-MX")} visitantes únicos` },
    {
      label: "Clics de intención",
      value: m.click_intents,
      note: `CTR ${pct(rate(m.click_intents, m.impressions))}${withOffer(m.click_intents_offer)}`,
    },
    { label: "Registros", value: m.registrations, note: `${pct(rate(m.registrations, m.click_intents))} de los clics` },
    {
      label: "Recibos",
      value: m.receipts,
      note: `Conversión total ${pct(rate(m.receipts, m.visitors || m.impressions))}${withOffer(m.receipts_offer)}`,
    },
  ];
  const clicks = Object.entries(m.by_plan).sort((a, b) => b[1] - a[1]);
  const revenue = Number(m.revenue);
  const offer = Number(m.revenue_offer ?? 0);
  const normal = Number(m.revenue_normal ?? revenue - offer);

  return (
    <article
      className={cn(
        "relative flex flex-col gap-4 rounded-2xl border bg-card p-5",
        winner && "border-gold/50 shadow-[0_0_40px_-16px_rgb(255_209_102/0.5)]"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-xl font-bold">{VARIANT_LABEL[m.variant]}</h3>
          <p className="text-sm text-cool">
            {config.offers.map((o) => `${formatMxn(o.price)} / ${INTERVAL_LABEL[o.interval].per}`).join(" · ")}
          </p>
        </div>
        {winner && (
          <span className="inline-flex items-center gap-1 rounded-full border border-gold/40 bg-gold/10 px-2.5 py-1 text-xs font-bold text-gold">
            <Trophy className="size-3.5" aria-hidden /> Ganadora
          </span>
        )}
      </div>
      {winner && <p className="-mt-2 text-xs text-gold">{winner}</p>}

      <ol className="flex flex-col gap-3">
        {steps.map((s) => (
          <li key={s.label} className="flex flex-col gap-1">
            <div className="flex items-baseline justify-between gap-2 text-sm">
              <span className="font-medium">{s.label}</span>
              <span className="text-lg font-bold tabular-nums">{s.value.toLocaleString("es-MX")}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-brand-gradient" style={{ width: `${Math.min(100, (s.value / base) * 100)}%` }} />
            </div>
            <p className="text-xs text-muted-foreground">{s.note}</p>
          </li>
        ))}
      </ol>

      <dl className="grid grid-cols-3 gap-2 text-sm">
        <Money label="Ingreso normal" value={normal} />
        <Money label="Ingreso con oferta" value={offer} />
        <Money label="Total" value={revenue} strong />
        <div className="col-span-3 rounded-xl bg-muted/50 px-3 py-2">
          <dt className="text-xs text-muted-foreground">Ingreso por visitante (total ÷ visitantes únicos)</dt>
          <dd className="text-lg font-bold tabular-nums">{formatMxn(Math.round(rate(revenue, m.visitors || m.impressions) * 100) / 100)}</dd>
        </div>
      </dl>

      {(clicks.length > 0 || m.mobile_share !== null) && (
        <div className="flex flex-col gap-1 border-t pt-3 text-xs text-muted-foreground">
          {clicks.length > 0 && (
            <p>
              Clics por oferta:{" "}
              {clicks
                .map(([k, n]) => {
                  const [plan, cycle] = k.split(":");
                  const per = INTERVAL_LABEL[cycle as keyof typeof INTERVAL_LABEL]?.name ?? cycle;
                  const sale = m.by_plan_offer?.[k] ?? 0;
                  return `${plan} ${per.toLowerCase()} (${n}${sale ? `, ${sale} con oferta` : ""})`;
                })
                .join(" · ")}
            </p>
          )}
          {m.mobile_share !== null && <p>Impresiones en celular: {pct(Number(m.mobile_share))}</p>}
        </div>
      )}
    </article>
  );
}

const withOffer = (n: number | undefined) => (n ? ` · ${n.toLocaleString("es-MX")} con oferta` : "");

function Money({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return (
    <div className="rounded-xl bg-muted/50 px-3 py-2">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={cn("text-base tabular-nums", strong ? "font-bold" : "font-semibold")}>{formatMxn(value)}</dd>
    </div>
  );
}
