"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

/** El enlace de invitación usa /auth?invite_code=…; el alta ocurre en el wizard de /registro. */
export function InviteRedirect() {
  const router = useRouter();
  const code = useSearchParams().get("invite_code");

  useEffect(() => {
    if (code) router.replace(`/registro?invite_code=${encodeURIComponent(code)}`);
  }, [code, router]);

  return null;
}
