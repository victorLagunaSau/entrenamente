import type { Flow, StepId } from "../types";

/**
 * Pasos de cada flujo. "profile" es la bienvenida: elegir perfil avanza directo
 * y no cuenta en la barra de progreso.
 */
export const FLOW_STEPS: Record<Flow, StepId[]> = {
  student: ["profile", "name", "account", "university", "career", "extra", "success"],
  parent: ["profile", "name", "account", "university", "career", "invite"],
  // El padre ya eligió escuela y carrera y pagó la licencia: sin perfil, meta ni pagos.
  invited: ["name", "account", "extra", "success"],
};

export const STEP_TITLES: Record<StepId, string> = {
  profile: "Perfil",
  name: "Tu nombre",
  account: "Tu cuenta",
  university: "Universidad",
  career: "Carrera",
  extra: "Sobre ti",
  success: "¡Listo!",
  invite: "Invitación",
};

/** En estos pasos se crea la cuenta al presionar "Siguiente". */
export const SUBMIT_STEP: Record<Flow, StepId> = {
  student: "extra",
  parent: "career",
  invited: "extra",
};
