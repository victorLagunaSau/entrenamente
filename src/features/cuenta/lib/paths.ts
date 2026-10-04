/** Pantalla de cuenta (todos los tipos de usuario); `?tab=` elige la pestaña. */
export const ACCOUNT_PATH = "/app/cuenta";

export const ACCOUNT_PATHS = {
  perfil: ACCOUNT_PATH,
  configuracion: `${ACCOUNT_PATH}?tab=configuracion`,
} as const;
