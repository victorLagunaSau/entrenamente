/**
 * Tipos del flujo de registro. `Profile` refleja la tabla `profiles` de Supabase
 * (supabase/migrations/20260926000000_usuarios_licencias.sql).
 */

/** Desde el registro solo se crean `student` y `parent`; el resto los asigna un admin. */
export type UserType = "student" | "parent" | "teacher" | "director" | "admin";

/** Espejo de la tabla `profiles` (perfil base; los pagos viven en `licenses`). */
export type Profile = {
  id: string;
  full_name: string;
  /** Nunca vacío: si no lo escriben, el servidor usa el primer nombre. */
  alias: string;
  email: string;
  user_type: UserType;
  avatar_url: string | null;
  privacy_accepted_at: string | null;
  privacy_version: string | null;
  created_at: string;
  updated_at: string;
};

/** Resultado de `get_my_access()`: el "interruptor" del estudiante. */
export type AccessStatus = "active" | "free" | "inactive";

/** Flujo A (estudiante), B (padre/tutor) o estudiante que llega con invitación. */
export type Flow = "student" | "parent" | "invited";

export type StepId = "profile" | "name" | "account" | "university" | "career" | "extra" | "success" | "invite";

export type AccountData = {
  fullName: string;
  alias: string;
  email: string;
  password: string;
  /** Aceptó el aviso de privacidad y los términos (obligatorio). */
  acceptedPrivacy: boolean;
};

/** Meta principal: 1 escuela + 1 carrera (después se pueden agregar más desde el panel). */
export type GoalData = {
  universityId: string | null;
  careerId: string | null;
};

export type ExtraData = {
  /** Texto libre, solo informativo. */
  originSchool: string;
  notStudying: boolean;
};

/** Invitación generada por un padre/tutor. */
export type Invite = {
  code: string;
  url: string;
  parentName: string;
  goal: GoalData;
  /** La licencia del padre tiene un lugar libre: al registrarse, el estudiante queda activo. */
  sponsored: boolean;
};

export type PlanId = "unlimited" | "family-basic" | "family-plus";
