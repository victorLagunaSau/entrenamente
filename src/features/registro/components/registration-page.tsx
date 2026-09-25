"use client";

import { useSearchParams } from "next/navigation";

import type { Flow } from "../types";
import { RegistrationWizard } from "./registration-wizard";

/** `?perfil=` en español para enlaces públicos (landing, campañas). */
const PERFILES: Record<string, Exclude<Flow, "invited">> = { estudiante: "student", tutor: "parent" };

/** Lee los parámetros en cliente: la ruta también se exporta estática para Capacitor. */
export function RegistrationPage() {
  const params = useSearchParams();
  const inviteCode = params.get("invite_code");
  const initialFlow = PERFILES[params.get("perfil") ?? ""] ?? null;
  return <RegistrationWizard inviteCode={inviteCode} initialFlow={initialFlow} />;
}
