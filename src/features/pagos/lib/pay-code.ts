/** Clave corta de un pago, igual en Stripe (descripción del pago) y en el admin (tarjeta del recibo). */

const PLAN_CODE: Record<string, string> = { student: "EST", tutor: "TUT", duo: "DUO", familia: "FAM" };
const CYCLE_CODE: Record<string, string> = { monthly: "M", quarterly: "T", annual: "A" };

/** EST-M-40 = Estudiante mensual con 40 %; FAM6-A = Familia de 6, anual, precio normal. */
export function payCode(p: { plan_id: string; billing_cycle: string; seats: number; discount_pct?: number | null }) {
  const plan = (PLAN_CODE[p.plan_id] ?? p.plan_id.toUpperCase()) + (p.plan_id === "familia" ? p.seats : "");
  const parts = [plan, CYCLE_CODE[p.billing_cycle] ?? p.billing_cycle];
  if (p.discount_pct) parts.push(String(Number(p.discount_pct)));
  return parts.join("-");
}
