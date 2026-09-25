"use client";

import { BadgeCheck } from "lucide-react";

import { useRegistration } from "../context/registration-context";
import { findCareer, findUniversity } from "../data/catalog";

/** Aviso para el estudiante que llega con el enlace de su padre/tutor. */
export function InviteBanner() {
  const { state } = useRegistration();
  if (state.invite.status !== "valid") return null;
  const { parentName, goal } = state.invite.invite;
  const university = findUniversity(goal.universityId);
  const career = findCareer(goal.universityId, goal.careerId);

  return (
    <div className="flex gap-3 rounded-xl border border-secondary/30 bg-secondary/10 p-4">
      <BadgeCheck className="size-5 shrink-0 text-secondary" aria-hidden />
      <div className="text-sm">
        <p className="font-semibold text-foreground">{parentName} te invitó y ya activó tu licencia.</p>
        {university && career && (
          <p className="mt-1 text-cool">
            Tu meta: <span className="font-medium">{university.short}</span> · {career.name}
          </p>
        )}
      </div>
    </div>
  );
}
