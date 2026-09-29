/**
 * Textos por tipo de tutor y catálogo de planes del home Padre / Maestro (por ahora solo front: el pago
 * y la creación de la licencia vendrán con /acceso-ilimitado). Los planes docentes son provisionales.
 */

import type { UserType } from "@/features/modes/modes";

import type { TutorLicense } from "../services/tutor-service";

export type TutorKind = "parent" | "teacher";

/** Padres (y admin en vista previa) ven el panel familiar; maestros y directores, el docente. */
export const tutorKindOf = (userType: UserType): TutorKind =>
  userType === "teacher" || userType === "director" ? "teacher" : "parent";

export const TUTOR_COPY: Record<TutorKind, { title: string; subtitle: string; students: string; student: string; groupsHint: string }> = {
  parent: {
    title: "Panel de Control Familiar / Tutor",
    subtitle: "Da seguimiento al entrenamiento de tus hijos y administra sus licencias.",
    students: "tus hijos",
    student: "hijo/a",
    groupsHint: "Ej. Hijos, Primos, Prepa 2027",
  },
  teacher: {
    title: "Panel de Control Docente / Grupos",
    subtitle: "Organiza a tus alumnos por grupo y mide su avance en cada modalidad.",
    students: "tus alumnos",
    student: "alumno/a",
    groupsHint: "Ej. Tercero A, Ingenierías 2027",
  },
};

/**
 * Un plan de tutor. `perStudent`: el precio es por estudiante y `seats` es el mínimo (el tutor elige cuántos);
 * si no, `priceMxn` es el total mensual por `seats` fijos.
 */
export type TutorPlan = {
  id: string;
  name: string;
  tagline: string;
  seats: number;
  perStudent: boolean;
  priceMxn: number;
  perks: string[];
  /** Etiqueta destacada en la tarjeta. */
  badge?: string;
};

/** Plan elegido con sus cupos (en los de precio fijo, `seats` = los del plan). */
export type PlanChoice = { plan: TutorPlan; seats: number };

export const TUTOR_PLANS: Record<TutorKind, TutorPlan[]> = {
  parent: [
    {
      id: "tutor",
      name: "Plan Tutor",
      badge: "Plan más popular",
      tagline: "Acceso ilimitado para tu estudiante y tú lo acompañas en su preparación.",
      seats: 1,
      perStudent: false,
      priceMxn: 120,
      perks: [
        "Acceso ilimitado para 1 estudiante: Plan, Examen Libre y Modo Racha",
        "Panel para monitorear su avance, materia por materia",
        "Reportes para WhatsApp y en PDF",
      ],
    },
    {
      id: "duo",
      name: "Plan Dúo",
      tagline: "Extiende el acceso ilimitado a 2 estudiantes y dales seguimiento en un solo panel.",
      seats: 2,
      perStudent: false,
      priceMxn: 170,
      perks: [
        "Acceso ilimitado para 2 estudiantes",
        "Monitoreo de ambos en un solo panel",
        "Comparativa entre estudiantes y reportes",
      ],
    },
    {
      id: "familia",
      name: "Plan Familia",
      tagline: "De 3 estudiantes en adelante: tú decides cuántos, al mejor precio por estudiante.",
      seats: 3,
      perStudent: true,
      priceMxn: 75,
      perks: [
        "Acceso ilimitado para los estudiantes que elijas",
        "Grupos para organizarlos (hijos, primos, sobrinos…)",
        "Estadísticas por estudiante y por grupo",
      ],
    },
  ],
  // PRECIOS PROVISIONALES: pendientes de definir los planes docentes.
  teacher: [
    {
      id: "docente_20",
      name: "Plan Docente 20",
      tagline: "Para un grupo: acceso ilimitado y seguimiento de hasta 20 alumnos.",
      seats: 20,
      perStudent: false,
      priceMxn: 900,
      perks: ["Acceso ilimitado para 20 alumnos", "Grupos y estadísticas por grupo", "Reportes para WhatsApp y en PDF"],
    },
    {
      id: "docente_50",
      name: "Plan Docente 50",
      tagline: "Para varios grupos: acceso ilimitado y seguimiento de hasta 50 alumnos.",
      seats: 50,
      perStudent: false,
      priceMxn: 2000,
      perks: ["Acceso ilimitado para 50 alumnos", "Grupos y estadísticas por grupo", "Reportes para WhatsApp y en PDF"],
    },
  ],
};

/** Total mensual de una elección. */
export const priceOf = ({ plan, seats }: PlanChoice) => (plan.perStudent ? plan.priceMxn * seats : plan.priceMxn);

/** Pago anual: 12 meses con este descuento. */
export const ANNUAL_DISCOUNT = 0.2;

export type BillingPeriod = "mensual" | "anual";

/** Enlace directo al pago (sin pasos intermedios). */
export const checkoutHref = ({ plan, seats }: PlanChoice, period: BillingPeriod) =>
  `/acceso-ilimitado?plan=${plan.id}&estudiantes=${seats}&periodo=${period}`;

/** Total del año con el descuento anual (Plan Tutor: $120 × 12 × 0.8 = $1,152). */
export const annualPriceOf = (choice: PlanChoice) => Math.round(priceOf(choice) * 12 * (1 - ANNUAL_DISCOUNT));

/**
 * Ahorro mensual frente a pagar un Plan Tutor por cada estudiante (solo planes familiares).
 * Plan Dúo: 2 × $120 = $240 → ahorras $70. Plan Familia: $45 por estudiante.
 */
export function savingsOf(kind: TutorKind, choice: PlanChoice): number {
  if (kind !== "parent") return 0;
  return Math.max(TUTOR_PLANS.parent[0].priceMxn * choice.seats - priceOf(choice), 0);
}

/** El plan que corresponde a una cantidad de cupos: el más grande que no los rebase. */
export function planForSeats(kind: TutorKind, seats: number): TutorPlan {
  const plans = TUTOR_PLANS[kind];
  return [...plans].reverse().find((p) => p.seats <= seats) ?? plans[0];
}

/** Lo que el tutor tiene hoy, traducido al catálogo (null sin licencia). */
export function currentChoice(kind: TutorKind, license: TutorLicense | null): PlanChoice | null {
  return license ? { plan: planForSeats(kind, license.seats), seats: license.seats } : null;
}

export function planName(kind: TutorKind, license: Pick<TutorLicense, "plan" | "seats">): string {
  if (license.plan === "promo") return `Plan Promocional · ${license.seats} ${license.seats === 1 ? "estudiante" : "estudiantes"}`;
  const plan = planForSeats(kind, license.seats);
  return plan.perStudent ? `${plan.name} · ${license.seats} estudiantes` : plan.name;
}

export const formatMxn = (n: number) =>
  n.toLocaleString("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 });

export const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" });

/** Una forma de ampliar el plan actual: cuántos estudiantes suma y cuánto más paga al mes. */
export type UpgradeOffer = { choice: PlanChoice; added: number; extra: number };

/**
 * Ofertas para sumar estudiantes a lo que ya paga (regla del usuario): Tutor → Dúo o Familia (3);
 * Dúo → solo Familia (3); Familia → ninguna (solo se ven sus fechas). Maestros: el siguiente plan más grande.
 */
export function upgradeOffers(kind: TutorKind, license: TutorLicense | null): UpgradeOffer[] {
  const current = currentChoice(kind, license);
  if (!current || current.plan.perStudent) return [];
  const base = priceOf(current);
  const choices = TUTOR_PLANS[kind]
    .filter((p) => p.perStudent || p.seats > current.seats)
    .map((p): PlanChoice => ({ plan: p, seats: p.perStudent ? Math.max(p.seats, current.seats + 1) : p.seats }));
  return choices.map((choice) => ({ choice, added: choice.seats - current.seats, extra: priceOf(choice) - base }));
}
