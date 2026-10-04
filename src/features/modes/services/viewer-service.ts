/** Perfil de quien está en sesión. Su rol (profiles.user_type) solo se asigna por SQL. */

import { supabase } from "@/lib/supabase/client";

import type { UserType } from "../modes";

export type Viewer = {
  id: string;
  alias: string;
  fullName: string;
  email: string;
  userType: UserType;
  /** "preset:<id>", URL de Storage o null (inicial del apodo). */
  avatarUrl: string | null;
};

export async function getViewer(): Promise<Viewer | null> {
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) return null;

  // Filtrar por el propio id: padres y admins también pueden leer otros perfiles (RLS).
  const { data, error } = await supabase
    .from("profiles")
    .select("alias, full_name, email, user_type, avatar_url")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  return {
    id: userId,
    alias: data.alias,
    fullName: data.full_name,
    email: data.email,
    userType: data.user_type,
    avatarUrl: data.avatar_url,
  };
}
