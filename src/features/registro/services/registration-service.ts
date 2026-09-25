/**
 * Servicio de registro con Supabase. Los datos del wizard viajan en los metadatos de
 * `auth.signUp`; el trigger `handle_new_user` (supabase/migrations) crea el perfil, la meta
 * y la invitación, y valida los códigos del lado del servidor.
 *
 * Siguen SIMULADOS: el envío de la invitación por correo y Stripe Checkout.
 */

import { authErrorMessage } from "@/features/auth/services/auth-service";
import { authCallbackUrl, supabase } from "@/lib/supabase/client";

import type { AccountData, ExtraData, GoalData, Invite, PlanId, Profile, UserType } from "../types";

/** Error con mensaje listo para mostrarse en el wizard. */
export class RegistrationError extends Error {}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

// El enlace sigue el formato del spec (/auth?invite_code=…); /auth lo redirige al wizard.
const inviteUrl = (code: string) => `${window.location.origin}/auth?invite_code=${code}`;

// Mismo alfabeto que valida la tabla `invites` (sin I, O, 0 ni 1).
function newCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

type SignUpResult = { profile: Profile; needsEmailConfirmation: boolean };

async function signUp(
  account: AccountData,
  userType: UserType,
  metadata: Record<string, string | boolean | null>,
  origin: Profile["access_origin"]
): Promise<SignUpResult> {
  const email = account.email.trim().toLowerCase();
  const { data, error } = await supabase.auth.signUp({
    email,
    password: account.password,
    options: {
      emailRedirectTo: authCallbackUrl(),
      data: { full_name: account.fullName.trim(), alias: account.alias.trim(), user_type: userType, ...metadata },
    },
  });
  if (error) throw new RegistrationError(authErrorMessage(error));
  // Con confirmación de correo activa, un correo ya registrado regresa un usuario sin identidades.
  if (!data.user || data.user.identities?.length === 0) {
    throw new RegistrationError("Este correo ya tiene una cuenta. Inicia sesión.");
  }

  const now = new Date().toISOString();
  return {
    needsEmailConfirmation: !data.session,
    // Sin sesión (correo sin confirmar) RLS no deja leer `profiles`: se refleja lo que guardó el trigger.
    profile: {
      id: data.user.id,
      full_name: account.fullName.trim(),
      alias: account.alias.trim() || null,
      email,
      user_type: userType,
      is_admin: false,
      payment_status: origin === "parent_invite" ? "paid" : "free_trial",
      access_origin: origin,
      license_coupon_code: null,
      granted_for_free_reason: null,
      authorized_by: null,
      license_expiration_date: null,
      created_at: now,
      updated_at: now,
    },
  };
}

export async function isEmailAvailable(email: string): Promise<boolean> {
  const { data, error } = await supabase.rpc("is_email_available", { p_email: email });
  if (error) throw error;
  return data === true;
}

export async function getInvite(code: string): Promise<Invite | null> {
  const { data, error } = await supabase.rpc("get_invite", { p_code: code });
  const row = !error && Array.isArray(data) ? data[0] : null;
  if (!row) return null;
  return {
    code: row.code,
    url: inviteUrl(row.code),
    parentName: row.parent_name,
    goal: { universityId: row.university_id, careerId: row.career_id },
  };
}

export async function registerStudent(input: {
  account: AccountData;
  goal: GoalData;
  extra: ExtraData;
  inviteCode?: string;
}): Promise<SignUpResult> {
  return signUp(
    input.account,
    "student",
    {
      university_id: input.goal.universityId,
      career_id: input.goal.careerId,
      origin_school: input.extra.notStudying ? "" : input.extra.originSchool.trim(),
      not_studying: input.extra.notStudying,
      invite_code: input.inviteCode ?? null,
    },
    input.inviteCode ? "parent_invite" : "free_trial"
  );
}

export async function registerParent(input: { account: AccountData; goal: GoalData }): Promise<
  SignUpResult & { invite: Invite }
> {
  const code = newCode();
  const result = await signUp(
    { ...input.account, alias: "" },
    "parent",
    { university_id: input.goal.universityId, career_id: input.goal.careerId, new_invite_code: code },
    "free_trial"
  );
  return {
    ...result,
    invite: { code, url: inviteUrl(code), parentName: input.account.fullName.trim(), goal: input.goal },
  };
}

export async function sendInviteEmail(code: string, to: string): Promise<void> {
  await wait(800);
  console.info(`[mock] Invitación ${code} enviada a ${to}`);
}

/** Simula Stripe Checkout. `simulateFailure` reproduce una tarjeta rechazada. */
export async function startCheckout(
  plan: PlanId,
  opts: { simulateFailure?: boolean } = {}
): Promise<{ ok: boolean; error?: string }> {
  await wait(1400);
  console.info(`[mock] Checkout de ${plan}`);
  if (opts.simulateFailure) return { ok: false, error: "Tu tarjeta fue rechazada. Intenta con otro método de pago." };
  return { ok: true };
}
