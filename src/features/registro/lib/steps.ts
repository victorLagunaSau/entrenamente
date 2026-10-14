import type { Flow, StepId } from "../types";

/**
 * Pasos de cada flujo. "profile" es la bienvenida: elegir perfil avanza directo
 * y no cuenta en la barra de progreso. La carrera va primero: nadie llena sus datos
 * para descubrir al final que su carrera no está.
 */
export const FLOW_STEPS: Record<Flow, StepId[]> = {
  student: ["profile", "career", "name", "account", "extra", "success"],
  parent: ["profile", "career", "name", "account", "invite"],
  // El padre ya eligió escuela y carrera: sin perfil, meta ni pagos.
  invited: ["name", "account", "extra", "success"],
};

/** Invitación sin meta ("que la elija mi hijo/a"): el estudiante busca su carrera primero. */
export const INVITED_OPEN_STEPS: StepId[] = ["career", "name", "account", "extra", "success"];

export const STEP_TITLES: Record<StepId, string> = {
  profile: "Perfil",
  name: "Tu nombre",
  account: "Tu cuenta",
  career: "Carrera",
  extra: "Sobre ti",
  success: "¡Listo!",
  invite: "Invitación",
};

/**
 * En estos pasos se crea la cuenta. El estudiante la crea en "Sobre ti" (opcional, justo después de la cuenta)
 * porque con confirmación de correo no hay sesión para guardar esos datos después.
 */
export const SUBMIT_STEP: Record<Flow, StepId> = {
  student: "extra",
  parent: "account",
  invited: "extra",
};
