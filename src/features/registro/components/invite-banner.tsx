"use client";

import { BadgeCheck } from "lucide-react";

import { useOpcionCarrera } from "@/features/catalogo";

import { useRegistration } from "../context/registration-context";

/** Aviso para el estudiante que llega con el enlace de su padre/tutor (ya trae su meta: se salta el buscador). */
export function InviteBanner() {
  const { state } = useRegistration();
  const invite = state.invite.status === "valid" ? state.invite.invite : null;
  const meta = useOpcionCarrera(invite?.goal.careerId);
  if (!invite) return null;
  const { parentName, sponsored } = invite;

  return (
    <div className="flex gap-3 rounded-xl border border-secondary/30 bg-secondary/10 p-4">
      <BadgeCheck className="size-5 shrink-0 text-secondary" aria-hidden />
      <div className="text-sm">
        <p className="font-semibold text-foreground">
          ¡Bienvenido! {sponsored ? `${parentName} te asignó una licencia` : `${parentName} te invitó a entrenar`}
          {meta ? " para preparar tu ingreso a:" : "."}
        </p>
        {meta && (
          <p className="mt-1 text-cool">
            <span className="font-medium">{meta.carrera.nombre}</span> en la{" "}
            <span className="font-medium">{meta.institucion.sigla}</span>
          </p>
        )}
      </div>
    </div>
  );
}
