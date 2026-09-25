/**
 * Servicio de registro SIMULADO. Misma firma que tendrá la versión con Supabase
 * (auth.signUp + insert en `profiles`) y Stripe; los componentes solo usan estas funciones.
 *
 * Datos de prueba:
 * - Correo ya registrado: `demo@entrenamente.com`
 * - Invitación válida siempre: `DEMO2026` (además de las que genere un padre en este navegador)
 */

import type { AccountData, ExtraData, GoalData, Invite, PlanId, Profile, UserType } from "../types";

const TAKEN_EMAILS = new Set(["demo@entrenamente.com"]);
const INVITES_KEY = "em:mock-invites";

const DEMO_INVITE: Omit<Invite, "url"> = {
  code: "DEMO2026",
  parentName: "Laura Méndez",
  goal: { universityId: "ipn", careerId: "ipn-sistemas" },
};

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

// El enlace sigue el formato del spec (/auth?invite_code=…); /auth lo redirige al wizard.
const inviteUrl = (code: string) => {
  const origin = typeof window === "undefined" ? "https://examente.com" : window.location.origin;
  return `${origin}/auth?invite_code=${code}`;
};

function readInvites(): Record<string, Omit<Invite, "url">> {
  try {
    return JSON.parse(localStorage.getItem(INVITES_KEY) ?? "{}");
  } catch {
    return {};
  }
}

function saveInvite(invite: Omit<Invite, "url">) {
  try {
    localStorage.setItem(INVITES_KEY, JSON.stringify({ ...readInvites(), [invite.code]: invite }));
  } catch {
    // Sin almacenamiento (modo privado): la invitación solo vive en esta sesión.
  }
}

function newCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 8 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
}

function mockProfile(account: AccountData, userType: UserType, origin: Profile["access_origin"]): Profile {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    full_name: account.fullName.trim(),
    alias: account.alias.trim() || null,
    email: account.email.trim().toLowerCase(),
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
  };
}

export async function isEmailAvailable(email: string): Promise<boolean> {
  await wait(400);
  return !TAKEN_EMAILS.has(email.trim().toLowerCase());
}

export async function getInvite(code: string): Promise<Invite | null> {
  await wait(500);
  const normalized = code.trim().toUpperCase();
  const found = normalized === DEMO_INVITE.code ? DEMO_INVITE : readInvites()[normalized];
  return found ? { ...found, url: inviteUrl(found.code) } : null;
}

export async function registerStudent(input: {
  account: AccountData;
  goal: GoalData;
  extra: ExtraData;
  inviteCode?: string;
}): Promise<Profile> {
  await wait(900);
  TAKEN_EMAILS.add(input.account.email.trim().toLowerCase());
  return mockProfile(input.account, "student", input.inviteCode ? "parent_invite" : "free_trial");
}

export async function registerParent(input: { account: AccountData; goal: GoalData }): Promise<{
  profile: Profile;
  invite: Invite;
}> {
  await wait(900);
  TAKEN_EMAILS.add(input.account.email.trim().toLowerCase());
  const invite = { code: newCode(), parentName: input.account.fullName.trim(), goal: input.goal };
  saveInvite(invite);
  return {
    profile: mockProfile({ ...input.account, alias: "" }, "parent", "free_trial"),
    invite: { ...invite, url: inviteUrl(invite.code) },
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
