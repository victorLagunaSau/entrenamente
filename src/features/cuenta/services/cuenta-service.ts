/**
 * Perfil y Configuración de la cuenta. Lee con `mi_cuenta()` y escribe con RPCs que validan en la base
 * (edad, teléfono solo de mayores, preferencias conocidas, cambio de tipo). Las fotos van al bucket
 * público `avatars` en la carpeta del propio usuario.
 */

import type { UserType } from "@/features/modes/modes";
import { supabase } from "@/lib/supabase/client";

import { AVATAR_MAX_INPUT_MB, AVATAR_MIN_SIDE, AVATAR_SIDE, AVATAR_TYPES } from "../lib/profile";

export class CuentaError extends Error {}

export type NotificationPrefs = {
  plan: boolean;
  racha: boolean;
  resultados: boolean;
  tutor_resumen: boolean;
  novedades: boolean;
  hora: string;
};

export type MiCuenta = {
  id: string;
  email: string;
  fullName: string;
  alias: string;
  userType: UserType;
  avatarUrl: string | null;
  birthDate: string | null;
  edad: number | null;
  phone: string | null;
  estado: string | null;
  notificationPrefs: NotificationPrefs;
  createdAt: string;
  privacyAcceptedAt: string | null;
  student: { originSchool: string | null; notStudying: boolean; grado: string | null; promedio: number | null } | null;
  tutores: { alias: string; userType: UserType }[];
  estudiantes: number;
  licenciaPropia: { plan: string; seats: number; expiresAt: string } | null;
};

type Row = {
  id: string;
  email: string;
  full_name: string;
  alias: string;
  user_type: UserType;
  avatar_url: string | null;
  birth_date: string | null;
  edad: number | null;
  phone: string | null;
  estado: string | null;
  notification_prefs: NotificationPrefs;
  created_at: string;
  privacy_accepted_at: string | null;
  student: { origin_school: string | null; not_studying: boolean; grado: string | null; promedio: number | null } | null;
  tutores: { alias: string; user_type: UserType }[];
  estudiantes: number;
  licencia_propia: { plan: string; seats: number; expires_at: string } | null;
};

function fail(error: { code?: string; message?: string }): never {
  if (error.code === "PGRST202" || error.code === "42883")
    throw new CuentaError("Falta correr en Supabase la migración 20261004020000_perfil_configuracion.sql.");
  throw new CuentaError(error.message || "Algo salió mal. Intenta de nuevo.");
}

export async function getMiCuenta(): Promise<MiCuenta> {
  const { data, error } = await supabase.rpc("mi_cuenta");
  if (error) fail(error);
  if (!data) throw new CuentaError("Inicia sesión para ver tu cuenta.");
  const r = data as Row;
  return {
    id: r.id,
    email: r.email,
    fullName: r.full_name,
    alias: r.alias,
    userType: r.user_type,
    avatarUrl: r.avatar_url,
    birthDate: r.birth_date,
    edad: r.edad,
    phone: r.phone,
    estado: r.estado,
    notificationPrefs: r.notification_prefs,
    createdAt: r.created_at,
    privacyAcceptedAt: r.privacy_accepted_at,
    student: r.student && {
      originSchool: r.student.origin_school,
      notStudying: r.student.not_studying,
      grado: r.student.grado,
      promedio: r.student.promedio === null ? null : Number(r.student.promedio),
    },
    tutores: r.tutores.map((t) => ({ alias: t.alias, userType: t.user_type })),
    estudiantes: r.estudiantes,
    licenciaPropia: r.licencia_propia && {
      plan: r.licencia_propia.plan,
      seats: r.licencia_propia.seats,
      expiresAt: r.licencia_propia.expires_at,
    },
  };
}

export type PerfilInput = {
  fullName: string;
  alias: string;
  birthDate: string | null;
  phone: string | null;
  estado: string | null;
  originSchool: string | null;
  notStudying: boolean;
  grado: string | null;
  promedio: number | null;
};

export async function savePerfil(input: PerfilInput) {
  const { error } = await supabase.rpc("guardar_mi_perfil", {
    p_full_name: input.fullName,
    p_alias: input.alias,
    p_birth_date: input.birthDate,
    p_phone: input.phone,
    p_estado: input.estado,
    p_origin_school: input.originSchool,
    p_not_studying: input.notStudying,
    p_grado: input.grado,
    p_promedio: input.promedio,
  });
  if (error) fail(error);
}

export async function saveNotificaciones(prefs: Partial<NotificationPrefs>): Promise<NotificationPrefs> {
  const { data, error } = await supabase.rpc("guardar_mis_notificaciones", { p_prefs: prefs });
  if (error) fail(error);
  return data as NotificationPrefs;
}

export async function setAvatar(avatar: string | null) {
  const { error } = await supabase.rpc("guardar_mi_avatar", { p_avatar: avatar });
  if (error) fail(error);
}

/** Lee la imagen, valida tipo/peso/tamaño y la recorta al centro en un cuadrado WebP de AVATAR_SIDE px. */
async function toSquareWebp(file: File): Promise<Blob> {
  if (!AVATAR_TYPES.includes(file.type)) throw new CuentaError("Usa una foto JPG, PNG o WebP.");
  if (file.size > AVATAR_MAX_INPUT_MB * 1024 * 1024)
    throw new CuentaError(`La foto pesa más de ${AVATAR_MAX_INPUT_MB} MB. Elige una más ligera.`);

  const bitmap = await createImageBitmap(file).catch(() => {
    throw new CuentaError("No pudimos leer esa imagen.");
  });
  const side = Math.min(bitmap.width, bitmap.height);
  if (side < AVATAR_MIN_SIDE)
    throw new CuentaError(`La foto es muy pequeña: necesita al menos ${AVATAR_MIN_SIDE} × ${AVATAR_MIN_SIDE} px.`);

  const out = Math.min(side, AVATAR_SIDE);
  const canvas = document.createElement("canvas");
  canvas.width = out;
  canvas.height = out;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new CuentaError("Tu navegador no pudo procesar la foto.");
  ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, out, out);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.85));
  if (!blob) throw new CuentaError("Tu navegador no pudo procesar la foto.");
  return blob;
}

/** Sube la foto procesada, la deja como avatar y borra las anteriores. Devuelve su URL pública. */
export async function uploadAvatar(userId: string, file: File): Promise<string> {
  const blob = await toSquareWebp(file);
  const path = `${userId}/avatar-${Date.now()}.webp`;
  const { error } = await supabase.storage.from("avatars").upload(path, blob, { contentType: "image/webp" });
  if (error) fail(error);
  const url = supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl;
  await setAvatar(url);
  await removeUploadedAvatars(userId, path);
  return url;
}

/** Borra las fotos subidas del usuario (menos `keep`). Si falla, solo quedan archivos huérfanos. */
export async function removeUploadedAvatars(userId: string, keep?: string) {
  const { data } = await supabase.storage.from("avatars").list(userId);
  const old = (data ?? []).map((f) => `${userId}/${f.name}`).filter((p) => p !== keep);
  if (old.length > 0) await supabase.storage.from("avatars").remove(old);
}

export async function changeUserType(tipo: "student" | "parent") {
  const { error } = await supabase.rpc("cambiar_mi_tipo", { p_tipo: tipo });
  if (error) fail(error);
}

export async function deleteMyAccount(userId: string) {
  await removeUploadedAvatars(userId).catch(() => undefined);
  const { error } = await supabase.rpc("eliminar_mi_cuenta");
  if (error) fail(error);
  await supabase.auth.signOut({ scope: "local" });
}

/** Proveedores con los que entra: "email" (contraseña) y/o "google". */
export async function getAuthProviders(): Promise<string[]> {
  const { data } = await supabase.auth.getUser();
  const providers = data.user?.app_metadata?.providers;
  return Array.isArray(providers) ? (providers as string[]) : data.user?.app_metadata?.provider ? [data.user.app_metadata.provider] : [];
}

export async function signOutEverywhere() {
  const { error } = await supabase.auth.signOut({ scope: "global" });
  if (error) throw new CuentaError("No pudimos cerrar tus sesiones. Intenta de nuevo.");
}
