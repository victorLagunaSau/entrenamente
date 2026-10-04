/**
 * Servicio de registro con Supabase. Los datos del wizard viajan en los metadatos de
 * `auth.signUp`; el trigger `handle_new_user` (supabase/migrations) crea el perfil base,
 * el perfil de estudiante, la meta inicial y la invitación; valida los códigos y, si la
 * invitación trae una licencia con lugar libre, asigna ese lugar. El apodo vacío se
 * completa en el servidor con el primer nombre.
 *
 * La invitación la manda el propio padre (WhatsApp, correo o menú de compartir).
 * Sigue SIMULADO: Stripe Checkout.
 */

import { authErrorMessage } from "@/features/auth/services/auth-service";
import { PRIVACY_VERSION } from "@/features/legal/content";
import { inviteUrl } from "@/features/invitacion/lib/invite-link";
import { authCallbackUrl, supabase } from "@/lib/supabase/client";

import type { AccountData, ExtraData, GoalData, Invite, PlanId } from "../types";

/** Error con mensaje listo para mostrarse en el wizard. */
export class RegistrationError extends Error {}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Mismo alfabeto que valida la tabla `invites` (sin I, O, 0 ni 1).
function newCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

type SignUpResult = { userId: string; needsEmailConfirmation: boolean };

async function signUp(
  account: AccountData,
  userType: "student" | "parent",
  metadata: Record<string, string | boolean | null>
): Promise<SignUpResult> {
  const email = account.email.trim().toLowerCase();
  const { data, error } = await supabase.auth.signUp({
    email,
    password: account.password,
    options: {
      emailRedirectTo: authCallbackUrl(),
      data: {
        full_name: account.fullName.trim(),
        alias: account.alias.trim(),
        user_type: userType,
        accepted_privacy: account.acceptedPrivacy,
        privacy_version: PRIVACY_VERSION,
        ...metadata,
      },
    },
  });
  if (error) throw new RegistrationError(authErrorMessage(error));
  // Con confirmación de correo activa, un correo ya registrado regresa un usuario sin identidades.
  if (!data.user || data.user.identities?.length === 0) {
    throw new RegistrationError("Este correo ya tiene una cuenta. Inicia sesión.");
  }
  return { userId: data.user.id, needsEmailConfirmation: !data.session };
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
    sponsored: row.sponsored === true,
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
    }
  );
}

export async function registerParent(input: { account: AccountData; goal: GoalData }): Promise<
  SignUpResult & { invite: Invite }
> {
  const code = newCode();
  const result = await signUp(
    { ...input.account, alias: "" },
    "parent",
    { university_id: input.goal.universityId, career_id: input.goal.careerId, new_invite_code: code }
  );
  return {
    ...result,
    // Invitación del primer hijo con la meta del padre; si después activa un plan, el hijo ocupa su lugar al registrarse.
    invite: { code, url: inviteUrl(code), parentName: input.account.fullName.trim(), goal: input.goal, sponsored: false },
  };
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
