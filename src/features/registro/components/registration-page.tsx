"use client";

import { useSearchParams } from "next/navigation";

import { RegistrationWizard } from "./registration-wizard";

/** Lee `invite_code` en cliente: la ruta también se exporta estática para Capacitor. */
export function RegistrationPage() {
  const inviteCode = useSearchParams().get("invite_code");
  return <RegistrationWizard inviteCode={inviteCode} />;
}
