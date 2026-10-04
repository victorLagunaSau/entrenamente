"use client";

import * as React from "react";
import { ArrowLeft, Check, CircleAlert, GraduationCap, Plus, Share2, Shuffle, UserPlus, X } from "lucide-react";

import { UniversityBadge } from "@/components/layout/university-badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ShareInvite } from "@/features/invitacion";
import { findCareer, findUniversity, UNIVERSITIES } from "@/features/registro/data/catalog";
import { cn } from "@/lib/utils";

import { TUTOR_COPY } from "../lib/tutor-plans";
import {
  cancelInvite,
  createInvite,
  errorMessage,
  listInvites,
  studentLimit,
  type PendingInvite,
} from "../services/tutor-service";
import { useTutor } from "./tutor-context";

/** "+ Invitar Estudiante": un enlace por estudiante, con o sin universidad y carrera elegidas por el tutor. */
export function InviteButton({ disabled, variant = "brand" }: { disabled?: boolean; variant?: "brand" | "outline" }) {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <Button variant={variant} onClick={() => setOpen(true)} disabled={disabled}>
        <UserPlus /> Invitar Estudiante
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">{open && <InviteBody />}</DialogContent>
      </Dialog>
    </>
  );
}

type View = { name: "list" } | { name: "new" } | { name: "created"; link: { code: string; url: string } };

const loadError = (e: unknown) =>
  e && typeof e === "object" && "code" in e && e.code === "PGRST202"
    ? "Falta correr en Supabase la migración 20261003000000_invitaciones_por_estudiante.sql."
    : errorMessage(e, "No pudimos cargar tus invitaciones.");

function InviteBody() {
  const { kind, panel } = useTutor();
  const copy = TUTOR_COPY[kind];
  const [invites, setInvites] = React.useState<PendingInvite[] | null>(null);
  const [error, setError] = React.useState("");
  const [view, setView] = React.useState<View>({ name: "list" });
  const license = panel?.license;
  const limit = panel ? studentLimit(panel) : 1;
  const free = Math.max(limit - (panel?.students.length ?? 0) - (invites?.length ?? 0), 0);

  const load = React.useCallback(async () => {
    setError("");
    try {
      const list = await listInvites();
      setInvites(list);
      return list;
    } catch (e) {
      setError(loadError(e));
      return null;
    }
  }, []);

  React.useEffect(() => {
    // Sin invitaciones pendientes se abre directo el formulario.
    load().then((list) => list?.length === 0 && setView({ name: "new" }));
  }, [load]);

  return (
    <>
      <DialogHeader>
        <DialogTitle>Invitar a {copy.students}</DialogTitle>
        <DialogDescription>
          Cada enlace es para un {copy.student}. Si eliges su universidad y carrera, las hereda al registrarse; si no,
          las elige al crear su cuenta.
        </DialogDescription>
      </DialogHeader>

      {!license?.active && (
        <p className="rounded-lg border border-gold/30 bg-gold/5 px-3 py-2 text-sm text-cool">
          Aún no tienes un plan activo: tus estudiantes se vincularán en modo inactivo hasta que actives uno.
        </p>
      )}

      {error ? (
        <div role="alert" className="flex flex-col items-start gap-3">
          <p className="flex items-center gap-2 text-sm text-destructive">
            <CircleAlert className="size-4 shrink-0" /> {error}
          </p>
          <Button variant="outline" size="sm" onClick={load}>
            Reintentar
          </Button>
        </div>
      ) : invites === null ? (
        <p className="text-sm text-muted-foreground">Cargando invitaciones…</p>
      ) : view.name === "new" ? (
        <NewInviteForm
          studentWord={copy.student}
          free={free}
          onCancel={invites.length > 0 ? () => setView({ name: "list" }) : undefined}
          onCreated={(link) => {
            setView({ name: "created", link });
            load();
          }}
        />
      ) : view.name === "created" ? (
        <div className="flex flex-col gap-4">
          <p className="flex items-center gap-2 text-sm font-medium text-secondary">
            <Check className="size-4" /> Enlace listo. Mándaselo a tu {copy.student}.
          </p>
          <ShareInvite link={view.link} />
          <Button variant="outline" onClick={() => setView({ name: "list" })}>
            Ver mis invitaciones
          </Button>
        </div>
      ) : (
        <InviteList invites={invites} free={free} limit={limit} onNew={() => setView({ name: "new" })} onChange={load} />
      )}
    </>
  );
}

function InviteList({
  invites,
  free,
  limit,
  onNew,
  onChange,
}: {
  invites: PendingInvite[];
  free: number;
  limit: number;
  onNew: () => void;
  onChange: () => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Te {free === 1 ? "queda" : "quedan"} <strong className="text-foreground">{free}</strong> de {limit}{" "}
        {limit === 1 ? "lugar" : "lugares"} para invitar.
      </p>

      {invites.length > 0 && (
        <ul className="flex flex-col gap-2" aria-label="Invitaciones pendientes">
          {invites.map((invite) => (
            <InviteRow key={invite.code} invite={invite} onChange={onChange} />
          ))}
        </ul>
      )}

      <Button onClick={onNew} disabled={free === 0} size="lg">
        <Plus /> Nueva invitación
      </Button>
      {free === 0 && (
        <p className="text-xs text-muted-foreground">
          Usaste todos los lugares de tu plan. Cancela una invitación pendiente o amplía tu plan para invitar a otro.
        </p>
      )}
    </div>
  );
}

function InviteRow({ invite, onChange }: { invite: PendingInvite; onChange: () => void }) {
  const [open, setOpen] = React.useState(false);
  const [confirming, setConfirming] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const university = findUniversity(invite.universityId);
  const career = findCareer(invite.universityId, invite.careerId);

  const cancel = async () => {
    setBusy(true);
    setError("");
    try {
      await cancelInvite(invite.code);
      onChange();
    } catch (e) {
      setError(errorMessage(e, "No pudimos cancelar la invitación."));
      setBusy(false);
    }
  };

  return (
    <li className="flex flex-col gap-3 rounded-xl border bg-background/40 p-3">
      <div className="flex items-center gap-3">
        {university ? (
          <UniversityBadge id={university.id} label={university.short} size="sm" />
        ) : (
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
            <Shuffle className="size-4" aria-hidden />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">{invite.label ?? "Invitación sin nombre"}</p>
          <p className="truncate text-xs text-muted-foreground">
            {career ? career.name : "Elegirá su universidad y carrera"} ·{" "}
            <span className="font-mono tracking-wider">{invite.code}</span>
          </p>
        </div>
        <Button variant={open ? "secondary" : "outline"} size="sm" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
          <Share2 /> Compartir
        </Button>
      </div>

      {open && <ShareInvite link={invite} />}

      {confirming ? (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-cool">¿Cancelar esta invitación? El enlace dejará de funcionar.</span>
          <Button variant="outline" size="sm" onClick={cancel} disabled={busy} className="text-destructive">
            {busy ? "Cancelando…" : "Sí, cancelar"}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setConfirming(false)} disabled={busy}>
            No
          </Button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="inline-flex items-center gap-1 self-start text-xs text-muted-foreground underline-offset-4 hover:text-cool hover:underline"
        >
          <X className="size-3.5" aria-hidden /> Cancelar invitación
        </button>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </li>
  );
}

const selectClass =
  "border-input flex h-11 w-full rounded-md border bg-background/60 px-3 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:opacity-50";

function NewInviteForm({
  studentWord,
  free,
  onCancel,
  onCreated,
}: {
  studentWord: string;
  free: number;
  onCancel?: () => void;
  onCreated: (link: { code: string; url: string }) => void;
}) {
  const [label, setLabel] = React.useState("");
  const [chooseGoal, setChooseGoal] = React.useState(true);
  const [universityId, setUniversityId] = React.useState("");
  const [careerId, setCareerId] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const university = findUniversity(universityId || null);
  const missingGoal = chooseGoal && (!universityId || !careerId);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (missingGoal || free === 0) return;
    setBusy(true);
    setError("");
    try {
      onCreated(
        await createInvite({
          label,
          universityId: chooseGoal ? universityId : null,
          careerId: chooseGoal ? careerId : null,
        })
      );
    } catch (err) {
      setError(errorMessage(err, "No pudimos crear la invitación."));
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      {free === 0 && (
        <p className="rounded-lg border border-gold/30 bg-gold/5 px-3 py-2 text-sm text-cool">
          Usaste todos los lugares de tu plan. Cancela una invitación pendiente o amplía tu plan.
        </p>
      )}

      <div className="flex flex-col gap-2">
        <label htmlFor="invite-label" className="flex items-baseline justify-between text-sm font-medium text-cool">
          ¿Para quién es?
          <span className="text-xs font-normal text-muted-foreground">Opcional</span>
        </label>
        <Input
          id="invite-label"
          value={label}
          maxLength={60}
          placeholder="Ej. Ana"
          onChange={(e) => setLabel(e.target.value)}
        />
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-medium text-cool">Universidad y carrera</legend>
        <div className="grid grid-cols-2 gap-2">
          <GoalOption selected={chooseGoal} onClick={() => setChooseGoal(true)} icon={<GraduationCap />}>
            Las elijo yo
          </GoalOption>
          <GoalOption selected={!chooseGoal} onClick={() => setChooseGoal(false)} icon={<Shuffle />}>
            Que las elija mi {studentWord}
          </GoalOption>
        </div>
      </fieldset>

      {chooseGoal && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <label htmlFor="invite-university" className="text-sm font-medium text-cool">
              Universidad
            </label>
            <select
              id="invite-university"
              className={selectClass}
              value={universityId}
              onChange={(e) => {
                setUniversityId(e.target.value);
                setCareerId("");
              }}
            >
              <option value="">Elige una</option>
              {UNIVERSITIES.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.short} · {u.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="invite-career" className="text-sm font-medium text-cool">
              Carrera
            </label>
            <select
              id="invite-career"
              className={selectClass}
              value={careerId}
              disabled={!university}
              onChange={(e) => setCareerId(e.target.value)}
            >
              <option value="">{university ? "Elige una" : "Primero la universidad"}</option>
              {university?.careers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className="flex items-center gap-2 text-sm text-destructive">
          <CircleAlert className="size-4 shrink-0" /> {error}
        </p>
      )}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
        {onCancel ? (
          <Button type="button" variant="ghost" onClick={onCancel} disabled={busy}>
            <ArrowLeft /> Mis invitaciones
          </Button>
        ) : (
          <span />
        )}
        <Button type="submit" size="lg" disabled={busy || missingGoal || free === 0}>
          {busy ? "Creando enlace…" : "Crear enlace"}
        </Button>
      </div>
    </form>
  );
}

function GoalOption({
  selected,
  onClick,
  icon,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 rounded-xl border-2 p-3 text-left text-sm font-medium transition-colors [&_svg]:size-4 [&_svg]:shrink-0",
        "focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
        selected ? "border-primary bg-primary/10 text-foreground" : "border-border bg-background/40 text-cool hover:bg-accent/40"
      )}
    >
      {icon}
      {children}
    </button>
  );
}
