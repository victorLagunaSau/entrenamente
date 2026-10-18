"use client";

import * as React from "react";
import Link from "next/link";
import { BellRing, X } from "lucide-react";

import { Button } from "@/components/ui/button";

import { dismissPlanRequests, getPlanRequests, type PlanRequest } from "../services/vinculo-service";

/**
 * Panel del tutor: avisos de los estudiantes que le piden activar o renovar su plan (uno por estudiante,
 * el más reciente). "Ver planes" lleva a Suscripción; cualquiera de los dos botones lo marca como atendido.
 */
export function PlanRequestsBanner({ child }: { child: boolean }) {
  const [requests, setRequests] = React.useState<PlanRequest[]>([]);

  React.useEffect(() => {
    getPlanRequests()
      .then(setRequests)
      .catch(() => setRequests([]));
  }, []);

  const byStudent = [...new Map(requests.map((r) => [r.studentId, r])).values()];
  if (!byStudent.length) return null;

  const dismiss = (studentId: string) => {
    const ids = requests.filter((r) => r.studentId === studentId).map((r) => r.id);
    setRequests((rs) => rs.filter((r) => r.studentId !== studentId));
    dismissPlanRequests(ids).catch(() => null);
  };

  return (
    <div className="flex flex-col gap-2">
      {byStudent.map((r) => (
        <section
          key={r.studentId}
          role="status"
          className="flex flex-col gap-3 rounded-2xl border border-secondary/40 bg-secondary/10 p-4 sm:flex-row sm:items-center"
        >
          <BellRing className="size-5 shrink-0 text-secondary" aria-hidden />
          <p className="flex-1 text-sm text-pretty">
            {child ? "Tu hijo" : "Tu estudiante"} <b>{r.name}</b> te solicita activar o renovar la suscripción de su cuenta
            para continuar con sus simulacros.
          </p>
          <div className="flex shrink-0 items-center gap-1">
            <Button asChild size="sm" onClick={() => dismiss(r.studentId)}>
              <Link href="/app/dashboard/billing">Ver planes</Link>
            </Button>
            <Button variant="ghost" size="icon" aria-label="Descartar aviso" onClick={() => dismiss(r.studentId)}>
              <X />
            </Button>
          </div>
        </section>
      ))}
    </div>
  );
}
