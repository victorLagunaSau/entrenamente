"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { homePathForCurrentUser } from "@/features/auth/services/auth-service";
import { supabase } from "@/lib/supabase/client";

import { REDIRECT_ATTR } from "../lib/session-redirect";

/** Respaldo del script en línea: con sesión (y sin panel recordado) resuelve el panel y redirige. */
export function LandingSessionRedirect() {
  const router = useRouter();

  React.useEffect(() => {
    let active = true;
    const show = () => document.documentElement.removeAttribute(REDIRECT_ATTR);
    supabase.auth
      .getSession()
      .then(async ({ data }) => {
        if (!active) return;
        if (!data.session) return show();
        router.replace(await homePathForCurrentUser());
      })
      .catch(show);
    return () => {
      active = false;
    };
  }, [router]);

  return null;
}
