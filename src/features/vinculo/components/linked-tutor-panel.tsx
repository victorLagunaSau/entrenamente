"use client";

import * as React from "react";
import { BellRing, CircleAlert, CircleCheck, Loader2, ShieldCheck, Unlink } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

import { errorText, getMyTutors, type MyTutor, requestPlanFromTutor, unlinkMyTutor } from "../services/vinculo-service";

/** Tutores del estudiante en sesión. undefined = cargando; [] = sin vínculo (o sin sesión). */
export function useMyTutors(enabled: boolean) {
  const [tutors, setTutors] = React.useState<MyTutor[] | undefined>(enabled ? undefined : []);

  const reload = React.useCallback(async () => {
    if (!enabled) return setTutors([]);
    setTutors(undefined);
    try {
      setTutors(await getMyTutors());
    } catch {
      setTutors([]);
    }
  }, [enabled]);

  React.useEffect(() => {
    reload();
  }, [reload]);

  return { tutors, reload };
}

const RECENT = 12 * 3_600_000;

const names = (tutors: MyTutor[]) => tutors.map((t) => t.name).join(" y ");

/**
 * Estudiante vinculado: en lugar de comprar ve el estado de su cuenta y le pide a su tutor activar o renovar
 * el plan. También puede desvincularse (vuelve a Demo y recupera la compra de su propio plan).
 */
export function LinkedTutorPanel({ tutors, onChange }: { tutors: MyTutor[]; onChange: () => void }) {
  const sponsored = tutors.some((t) => t.sponsors);
  const lastRequest = Math.max(0, ...tutors.map((t) => (t.lastRequestAt ? new Date(t.lastRequestAt).getTime() : 0)));
  const [sent, setSent] = React.useState(Date.now() - lastRequest < RECENT);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");

  const request = async () => {
    setBusy(true);
    setError("");
    try {
      await requestPlanFromTutor();
      setSent(true);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section
      aria-labelledby="linked-title"
      className="relative mx-auto flex w-full max-w-2xl flex-col gap-5 overflow-hidden rounded-3xl border bg-card p-6 sm:p-8"
    >
      <div aria-hidden className="pointer-events-none absolute -top-24 -right-20 size-72 rounded-full bg-success/10 blur-3xl" />
      <div className="relative flex flex-col gap-2">
        <p
          className={cn(
            "inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
            sponsored ? "bg-success/15 text-success" : "bg-gold/15 text-gold"
          )}
        >
          <span className={cn("size-1.5 rounded-full", sponsored ? "bg-success" : "bg-gold")} aria-hidden />
          {sponsored ? "Acceso activo" : "Plan sin activar"}
        </p>
        <h2 id="linked-title" className="flex items-center gap-2 text-xl font-bold text-balance sm:text-2xl">
          <ShieldCheck className="size-6 shrink-0 text-success" aria-hidden /> Cuenta vinculada a {names(tutors)}
        </h2>
        <p className="text-sm text-muted-foreground text-pretty">
          Tu acceso a los simulacros depende de la suscripción de tu tutor. Tu tutor es el administrador de tu licencia.
        </p>
      </div>

      <div className="relative flex flex-col gap-2">
        {sent ? (
          <p role="status" className="flex items-start gap-2 rounded-2xl border border-success/40 bg-success/10 p-4 text-sm">
            <CircleCheck className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
            Listo: le avisamos a tu tutor en su panel y por correo que quieres activar o renovar tu plan.
          </p>
        ) : (
          <Button size="lg" className="w-full sm:w-fit" disabled={busy} onClick={request}>
            {busy ? <Loader2 className="animate-spin" /> : <BellRing />} Solicitar a mi tutor activar/renovar plan
          </Button>
        )}
        {error && (
          <p role="alert" className="flex items-center gap-2 text-sm text-destructive">
            <CircleAlert className="size-4 shrink-0" /> {error}
          </p>
        )}
      </div>

      <div className="relative border-t pt-4">
        {tutors.map((t) => (
          <UnlinkButton key={t.id} tutor={t} onDone={onChange} several={tutors.length > 1} />
        ))}
      </div>
    </section>
  );
}

function UnlinkButton({ tutor, several, onDone }: { tutor: MyTutor; several: boolean; onDone: () => void }) {
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");

  const unlink = async () => {
    setBusy(true);
    setError("");
    try {
      await unlinkMyTutor(tutor.id);
      setOpen(false);
      onDone();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive" onClick={() => setOpen(true)}>
        <Unlink /> Desvincular mi cuenta{several ? ` de ${tutor.name}` : ""}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Desvincular tu cuenta de {tutor.name}?</DialogTitle>
            <DialogDescription>
              Perderás el acceso ilimitado a simulacros patrocinado por tu tutor y el monitoreo familiar. Tu cuenta volverá
              a la versión Demo y podrás contratar tu propio Plan Estudiante.
            </DialogDescription>
          </DialogHeader>
          {error && (
            <p role="alert" className="flex items-center gap-2 text-sm text-destructive">
              <CircleAlert className="size-4 shrink-0" /> {error}
            </p>
          )}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button className="bg-destructive hover:bg-destructive/90" disabled={busy} onClick={unlink}>
              {busy && <Loader2 className="animate-spin" />} Desvincular
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
