#!/usr/bin/env node
/**
 * Crea (o actualiza) en Stripe el catálogo de Entrena Mente: 4 productos, 9 precios con IVA incluido,
 * la tasa "IVA 16 % incluido" y la configuración del portal del cliente. Se puede correr las veces que sea:
 * lo que ya existe con el mismo monto se deja igual.
 *
 *   node --env-file=.env.local scripts/stripe-setup.mjs          # usa STRIPE_SECRET_KEY (sk_test_…)
 *   node --env-file=.env.local scripts/stripe-setup.mjs --live   # obligatorio para una clave real (sk_live_… o rk_live_…)
 *
 * Los montos son la lista de precios de la migración 20261019000000_precios_stripe.sql. Si cambian en Supabase,
 * cambiarlos aquí y volver a correrlo: el precio nuevo toma el lookup_key y el anterior se archiva.
 * (El cobro nunca depende de esta lista: si no coincide, el servidor usa el monto de Supabase.)
 */

import Stripe from "stripe";

const key = process.env.STRIPE_SECRET_KEY;
if (!key) {
  console.error("Falta STRIPE_SECRET_KEY (ponla en .env.local).");
  process.exit(1);
}
const live = /^(sk|rk)_live_/.test(key);
if (live && !process.argv.includes("--live")) {
  console.error("Es una clave de PRODUCCIÓN. Si de verdad quieres crear el catálogo real, agrega --live.");
  process.exit(1);
}

const stripe = new Stripe(key);
const APP = "entrenamente";

const PRODUCTS = [
  { id: "plan_student", name: "Plan Estudiante", description: "Acceso ilimitado para 1 estudiante." },
  { id: "plan_tutor", name: "Plan Tutor", description: "Acceso ilimitado para 1 estudiante + panel del tutor." },
  { id: "plan_duo", name: "Plan Dúo", description: "Acceso ilimitado para 2 estudiantes + panel del tutor." },
  { id: "plan_familia", name: "Plan Familia", description: "De 3 a 6 estudiantes, precio por estudiante." },
];

// Montos en pesos, IVA incluido. Familia: por estudiante (se cobra por cantidad).
const PRICES = [
  { lookup: "student_monthly", product: "plan_student", amount: 85, interval: "month", count: 1 },
  { lookup: "student_quarterly", product: "plan_student", amount: 219, interval: "month", count: 3 },
  { lookup: "student_annual", product: "plan_student", amount: 699, interval: "year", count: 1 },
  { lookup: "tutor_monthly", product: "plan_tutor", amount: 105, interval: "month", count: 1 },
  { lookup: "tutor_annual", product: "plan_tutor", amount: 879, interval: "year", count: 1 },
  { lookup: "duo_monthly", product: "plan_duo", amount: 169, interval: "month", count: 1 },
  { lookup: "duo_annual", product: "plan_duo", amount: 1399, interval: "year", count: 1 },
  { lookup: "familia_monthly", product: "plan_familia", amount: 75, interval: "month", count: 1 },
  { lookup: "familia_annual", product: "plan_familia", amount: 629, interval: "year", count: 1 },
];

async function ensureProduct(p) {
  try {
    const found = await stripe.products.retrieve(p.id);
    if (found.name !== p.name || found.description !== p.description || !found.active) {
      await stripe.products.update(p.id, { name: p.name, description: p.description, active: true });
    }
    return "listo";
  } catch (err) {
    if (err?.statusCode !== 404) throw err;
    await stripe.products.create({ id: p.id, name: p.name, description: p.description, metadata: { app: APP } });
    return "creado";
  }
}

async function ensurePrice(p) {
  const { data } = await stripe.prices.list({ lookup_keys: [p.lookup], limit: 1 });
  const current = data[0];
  const cents = p.amount * 100;
  if (
    current &&
    current.unit_amount === cents &&
    current.recurring?.interval === p.interval &&
    current.recurring?.interval_count === p.count
  ) {
    return `${current.id} (ya existía)`;
  }
  const created = await stripe.prices.create({
    product: p.product,
    currency: "mxn",
    unit_amount: cents,
    tax_behavior: "inclusive",
    recurring: { interval: p.interval, interval_count: p.count },
    lookup_key: p.lookup,
    transfer_lookup_key: true,
    metadata: { app: APP },
  });
  if (current) await stripe.prices.update(current.id, { active: false });
  return `${created.id} (${current ? "reemplazó al anterior" : "creado"})`;
}

async function ensureTaxRate() {
  const { data } = await stripe.taxRates.list({ active: true, limit: 100 });
  const found = data.find((t) => t.metadata?.app === APP && t.percentage === 16 && t.inclusive);
  if (found) return found.id;
  const created = await stripe.taxRates.create({
    display_name: "IVA",
    description: "IVA 16 % incluido en el precio",
    percentage: 16,
    inclusive: true,
    country: "MX",
    jurisdiction: "MX",
    tax_type: "vat",
    metadata: { app: APP },
  });
  return created.id;
}

async function ensurePortal() {
  const { data } = await stripe.billingPortal.configurations.list({ active: true, limit: 100 });
  const found = data.find((c) => c.metadata?.app === APP);
  const config = {
    business_profile: { headline: "Entrena Mente · Administra tu suscripción" },
    features: {
      invoice_history: { enabled: true },
      payment_method_update: { enabled: true },
      subscription_cancel: { enabled: true, mode: "at_period_end" },
    },
    metadata: { app: APP },
  };
  if (found) {
    await stripe.billingPortal.configurations.update(found.id, config);
    return found.id;
  }
  return (await stripe.billingPortal.configurations.create(config)).id;
}

console.log(`Stripe en modo ${live ? "PRODUCCIÓN" : "prueba"}\n`);
for (const p of PRODUCTS) console.log(`Producto ${p.id}: ${await ensureProduct(p)}`);
for (const p of PRICES) console.log(`Precio ${p.lookup} $${p.amount}: ${await ensurePrice(p)}`);
const tax = await ensureTaxRate();
const portal = await ensurePortal();
console.log(`\nTasa de IVA: ${tax}`);
console.log(`Portal del cliente: ${portal}`);
console.log(`\nAgrega a .env.local (y a Vercel):\nSTRIPE_TAX_RATE_IVA=${tax}`);
