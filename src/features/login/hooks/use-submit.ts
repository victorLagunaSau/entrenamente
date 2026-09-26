"use client";

import * as React from "react";

import type { AuthResult } from "@/features/auth/services/auth-service";

/** Estado de envío de un formulario: evita dobles envíos y guarda el error. */
export function useSubmit(action: (form: FormData) => Promise<AuthResult>, onSuccess: () => void | Promise<void>) {
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    const res = await action(new FormData(e.currentTarget));
    if (res.ok) await onSuccess();
    else {
      setError(res.error);
      setBusy(false);
    }
  };

  return { busy, error, onSubmit };
}
