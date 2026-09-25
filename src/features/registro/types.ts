/**
 * Tipos del flujo de registro. Reflejan la tabla `profiles` del spec para que
 * el cambio de servicios simulados a Supabase no toque los componentes.
 */

export type UserType = "student" | "parent" | "teacher";

export type PaymentStatus = "paid" | "unpaid" | "free_trial";

export type AccessOrigin = "free_trial" | "stripe_subscription" | "admin_grant" | "parent_invite";

/** Espejo de la tabla `profiles`. */
export type Profile = {
  id: string;
  full_name: string;
  alias: string | null;
  email: string;
  user_type: UserType;
  is_admin: boolean;
  payment_status: PaymentStatus;
  access_origin: AccessOrigin;
  license_coupon_code: string | null;
  granted_for_free_reason: string | null;
  authorized_by: string | null;
  license_expiration_date: string | null;
  created_at: string;
  updated_at: string;
};

/** Flujo A (estudiante), B (padre/tutor) o estudiante que llega con invitación. */
export type Flow = "student" | "parent" | "invited";

export type StepId = "profile" | "name" | "account" | "university" | "career" | "extra" | "success" | "invite";

export type AccountData = {
  fullName: string;
  alias: string;
  email: string;
  password: string;
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
};

export type PlanId = "unlimited" | "family-basic" | "family-plus";
