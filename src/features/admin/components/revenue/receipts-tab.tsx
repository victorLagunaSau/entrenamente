"use client";

import * as React from "react";
import { CalendarPlus, Loader2, Power, ReceiptText, Search, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/features/admin/ingest/components/fields";
import {
  type AdminFlashSale,
  type AdminPlan,
  extendReceipt,
  getPricingAdmin,
  issueReceipt,
  type Receipt,
  searchReceipts,
  setReceiptStatus,
} from "@/features/admin/services/revenue-service";
import { searchUsers, type UserHit, userTypeLabel } from "@/features/admin/services/users-service";
import { formatMxn, INTERVAL_LABEL, VARIANT_LABEL, type BillingInterval } from "@/features/pricing/lib/pricing";
import { cn } from "@/lib/utils";

import { ErrorLine, errorText, formatDay } from "./revenue-workspace";

/** Pestaña 2: buscador de recibos con su vigencia, extensión manual de días y desactivación. */
export function ReceiptsTab() {
  const [query, setQuery] = React.useState("");
  const [rows, setRows] = React.useState<Receipt[] | null>(null);
  const [searching, setSearching] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [issuing, setIssuing] = React.useState(false);

  const search = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setSearching(true);
    setError(null);
    try {
      setRows(await searchReceipts(query));
    } catch (err) {
      setError(errorText(err, "No pudimos buscar recibos."));
    } finally {
      setSearching(false);
    }
  };

  const replace = (r: Receipt) => setRows((rs) => rs?.map((x) => (x.id === r.id ? r : x)) ?? [r]);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 sm:flex-row">
        <form onSubmit={search} className="flex flex-1 gap-2">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Correo, apodo, nombre o código REC-…"
            aria-label="Buscar recibos"
            className="h-11"
          />
          <Button type="submit" className="h-11" disabled={searching}>
            {searching ? <Loader2 className="animate-spin motion-reduce:animate-none" /> : <Search />} Buscar
          </Button>
        </form>
        <Button variant={issuing ? "ghost" : "brand"} className="h-11" onClick={() => setIssuing((v) => !v)}>
          {issuing ? <X /> : <ReceiptText />} {issuing ? "Cerrar" : "Emitir recibo"}
        </Button>
      </div>
      {error && <ErrorLine text={error} />}

      {issuing && (
        <IssueReceipt
          onIssued={(r) => {
            setRows((rs) => [r, ...(rs ?? [])]);
            setIssuing(false);
          }}
        />
      )}

      {rows === null ? (
        <p className="rounded-2xl border bg-card p-5 text-sm text-muted-foreground">
          Busca por correo, apodo o código; con el buscador vacío, Buscar muestra los 50 recibos más recientes.
        </p>
      ) : rows.length === 0 ? (
        <p className="rounded-2xl border bg-card p-5 text-sm text-muted-foreground">Sin recibos.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((r) => (
            <ReceiptRow key={r.id} receipt={r} onChange={replace} />
          ))}
        </ul>
      )}
    </div>
  );
}

function ReceiptRow({ receipt: r, onChange }: { receipt: Receipt; onChange: (r: Receipt) => void }) {
  const [days, setDays] = React.useState("30");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const run = async (fn: () => Promise<Receipt>) => {
    setBusy(true);
    setError(null);
    try {
      onChange(await fn());
    } catch (e) {
      setError(errorText(e, "No pudimos actualizar el recibo."));
    } finally {
      setBusy(false);
    }
  };

  const state =
    r.status === "refunded"
      ? { label: "Desactivado", className: "bg-destructive/15 text-destructive" }
      : r.vigente
        ? { label: "Vigente", className: "bg-success/15 text-success" }
        : { label: "Vencido", className: "bg-muted text-cool" };

  return (
    <li className="flex flex-col gap-3 rounded-2xl border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-mono text-sm font-semibold">{r.receipt_code}</p>
          <p className="truncate text-sm">
            {r.user ? (
              <>
                <span className="font-semibold">{r.user.full_name || r.user.alias}</span>{" "}
                <span className="text-muted-foreground">· {r.user.email}</span>
              </>
            ) : (
              <span className="text-muted-foreground">Usuario eliminado</span>
            )}
          </p>
        </div>
        <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold", state.className)}>{state.label}</span>
      </div>

      <dl className="grid gap-2 text-sm sm:grid-cols-3 lg:grid-cols-6">
        <Cell label="Plan" value={`${r.plan_name ?? r.plan_id}${r.seats > 1 ? ` · ${r.seats} est.` : ""}`} />
        <Cell label="Monto" value={`${formatMxn(Number(r.amount_paid))} ${r.currency} · ${INTERVAL_LABEL[r.billing_cycle].name}`} />
        <Cell label="Fecha de compra" value={formatDay(r.license_starts_at)} />
        <Cell label="Días de licencia" value={String(r.duration_days)} />
        <Cell label="Expira" value={formatDay(r.license_expires_at)} />
        <Cell label="Variante" value={r.assigned_variant ? VARIANT_LABEL[r.assigned_variant] : "—"} />
      </dl>
      {r.notes && <p className="text-xs text-muted-foreground">Notas: {r.notes}</p>}

      <div className="flex flex-wrap items-center gap-2 border-t pt-3">
        <Input
          type="number"
          value={days}
          onChange={(e) => setDays(e.target.value)}
          aria-label="Días a extender"
          className="h-9 w-24"
        />
        <Button size="sm" variant="outline" disabled={busy || !Number(days)} onClick={() => void run(() => extendReceipt(r.id, Number(days)))}>
          <CalendarPlus /> Extender días
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className={r.status === "refunded" ? "text-success" : "text-destructive"}
          disabled={busy}
          onClick={() => void run(() => setReceiptStatus(r.id, r.status === "refunded" ? "active" : "refunded"))}
        >
          <Power /> {r.status === "refunded" ? "Reactivar" : "Desactivar recibo"}
        </Button>
        {busy && <Loader2 className="size-4 animate-spin text-brand-light motion-reduce:animate-none" />}
      </div>
      {error && <ErrorLine text={error} />}
    </li>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-xl bg-muted/50 px-3 py-2">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="truncate font-medium">{value}</dd>
    </div>
  );
}

const CYCLES: BillingInterval[] = ["monthly", "quarterly", "annual"];

/**
 * Compra simulada (fase previa a la pasarela): elige usuario, plan y periodo. Monto vacío = el que le toca
 * por su variante A/B (o la oferta elegida). Crea la licencia y cuenta como recibo en el embudo.
 */
function IssueReceipt({ onIssued }: { onIssued: (r: Receipt) => void }) {
  const [catalog, setCatalog] = React.useState<{ plans: AdminPlan[]; sales: AdminFlashSale[] } | null>(null);
  const [q, setQ] = React.useState("");
  const [hits, setHits] = React.useState<UserHit[] | null>(null);
  const [user, setUser] = React.useState<UserHit | null>(null);
  const [planId, setPlanId] = React.useState("");
  const [cycle, setCycle] = React.useState<BillingInterval>("monthly");
  const [seats, setSeats] = React.useState("3");
  const [amount, setAmount] = React.useState("");
  const [saleId, setSaleId] = React.useState("");
  const [notes, setNotes] = React.useState("Compra simulada");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    getPricingAdmin()
      .then((a) => setCatalog({ plans: a.plans, sales: a.flash_sales }))
      .catch((e) => setError(errorText(e, "No pudimos cargar los planes.")));
  }, []);

  const role = user ? (user.user_type === "student" ? "student" : "parent") : null;
  const plans = catalog?.plans.filter((p) => p.target_role === role && p.is_active) ?? [];
  const plan = plans.find((p) => p.id === planId) ?? null;
  const sales = catalog?.sales.filter((s) => s.target_role === role && (s.plan_id === planId || (s.plan_id === null && !!planId))) ?? [];

  const findUsers = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      setHits(await searchUsers(q));
    } catch (err) {
      setError(errorText(err, "No pudimos buscar usuarios."));
    }
  };

  const submit = async () => {
    if (!user || !plan) return;
    setBusy(true);
    setError(null);
    try {
      onIssued(
        await issueReceipt({
          userId: user.id,
          planId: plan.id,
          cycle,
          seats: plan.max_students > plan.min_students ? Number(seats) : null,
          amount: amount.trim() === "" ? null : Number(amount),
          saleId: saleId || null,
          notes,
        })
      );
    } catch (e) {
      setError(errorText(e, "No pudimos emitir el recibo."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-label="Emitir recibo" className="flex flex-col gap-4 rounded-2xl border border-gold/40 bg-gold/5 p-4 sm:p-5">
      <p className="text-sm text-cool">
        Emite un recibo de una compra simulada o confirmada a mano. Crea la licencia del usuario y cuenta en el embudo como
        recibo de su variante.
      </p>
      {!user ? (
        <>
          <form onSubmit={findUsers} className="flex gap-2">
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Busca al usuario (3+ letras)" className="h-11" aria-label="Buscar usuario" />
            <Button type="submit" className="h-11" disabled={q.trim().length < 3}>
              <Search /> Buscar
            </Button>
          </form>
          {hits && (
            <ul className="flex flex-col gap-1.5">
              {hits.length === 0 && <li className="text-sm text-muted-foreground">Sin resultados.</li>}
              {hits.map((h) => (
                <li key={h.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setUser(h);
                      setPlanId("");
                    }}
                    className="flex w-full items-center justify-between gap-2 rounded-xl border bg-card px-3 py-2 text-left text-sm hover:border-brand-light/50"
                  >
                    <span className="min-w-0 truncate">
                      <span className="font-semibold">{h.full_name || h.alias}</span> <span className="text-muted-foreground">· {h.email}</span>
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">{userTypeLabel(h.user_type)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : (
        <>
          <p className="flex items-center justify-between gap-2 rounded-xl bg-card px-3 py-2 text-sm">
            <span className="min-w-0 truncate">
              <span className="font-semibold">{user.full_name || user.alias}</span> · {userTypeLabel(user.user_type)}
            </span>
            <Button size="sm" variant="ghost" onClick={() => setUser(null)}>
              Cambiar
            </Button>
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Plan">
              <NativeSelect value={planId} onChange={(e) => setPlanId(e.target.value)}>
                <option value="">Elige…</option>
                {plans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Periodo">
              <NativeSelect value={cycle} onChange={(e) => setCycle(e.target.value as BillingInterval)} disabled={sales.some((s) => s.id === saleId && !s.discount_pct)}>
                {CYCLES.map((c) => (
                  <option key={c} value={c}>
                    {INTERVAL_LABEL[c].name}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            {plan && plan.max_students > plan.min_students && (
              <Field label={`Estudiantes (${plan.min_students}–${plan.max_students})`}>
                <Input type="number" min={plan.min_students} max={plan.max_students} value={seats} onChange={(e) => setSeats(e.target.value)} className="h-11" />
              </Field>
            )}
            {sales.length > 0 && (
              <Field label="Oferta flash">
                <NativeSelect value={saleId} onChange={(e) => setSaleId(e.target.value)}>
                  <option value="">Sin oferta</option>
                  {sales.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.title} · {s.discount_pct ? `−${Math.round(Number(s.discount_pct))} %` : formatMxn(Number(s.discounted_price))}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
            )}
            <Field label="Monto (MXN)">
              <Input type="number" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Automático" className="h-11" />
            </Field>
            <Field label="Notas">
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} className="h-11" />
            </Field>
          </div>
          <Button variant="brand" className="h-11 sm:w-fit" disabled={!plan || busy} onClick={() => void submit()}>
            {busy ? <Loader2 className="animate-spin motion-reduce:animate-none" /> : <ReceiptText />} Emitir recibo y licencia
          </Button>
        </>
      )}
      {error && <ErrorLine text={error} />}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex min-w-0 flex-col gap-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
