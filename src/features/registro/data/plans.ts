import type { PlanId } from "../types";

export type Plan = {
  id: PlanId;
  name: string;
  priceMxn: number;
  period: "mes";
  audience: "student" | "parent";
  features: string[];
};

// Precios del spec. Pendiente de confirmar qué distingue al Paquete Familiar de $70 y el de $150.
export const PLANS: Record<PlanId, Plan> = {
  unlimited: {
    id: "unlimited",
    name: "Plan Ilimitado",
    priceMxn: 40,
    period: "mes",
    audience: "student",
    features: ["Escuelas y carreras ilimitadas", "Simulacros sin límite", "Progreso y rachas"],
  },
  "family-basic": {
    id: "family-basic",
    name: "Paquete Familiar",
    priceMxn: 70,
    period: "mes",
    audience: "parent",
    features: ["Varias carreras por estudiante", "Panel de seguimiento", "Licencia para tu hijo/a"],
  },
  "family-plus": {
    id: "family-plus",
    name: "Paquete Familiar Plus",
    priceMxn: 150,
    period: "mes",
    audience: "parent",
    features: ["Más de 1 estudiante", "Carreras ilimitadas", "Comparativas entre estudiantes"],
  },
};

export const formatMxn = (n: number) => `$${n} MXN`;
