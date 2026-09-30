"use client";

import * as React from "react";
import { CircleAlert, KeyRound, Loader2, Pencil, Plus, Search, Trash2, UserX } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/features/admin/ingest/components/fields";
import type { LicensePlan } from "@/features/dashboard/services/tutor-service";
import { useMode } from "@/features/modes/components/mode-guard";
import type { UserType } from "@/features/modes/modes";
import {
  type AdminLicense,
  type AdminUser,
  AdminUsersError,
  LICENSE_PLANS,
  SOURCE_LABEL,
  USER_TYPES,
  type UserHit,
  changeUserType,
  deleteLicense,
  deleteUser,
  formatDay,
  getUser,
  grantLicense,
  planLabel,
  searchUsers,
  updateLicense,
  userTypeLabel,
} from "@/features/admin/services/users-service";
import { cn } from "@/lib/utils";

import { AdminPageHeader } from "./admin-module";

const messageOf = (e: unknown, fallback: string) => (e instanceof AdminUsersError ? e.message : fallback);

/** Buscar usuarios (solo al pulsar "Buscar"), ver su ficha, cambiar su tipo, administrar licencias y borrarlos. */
export function UsersWorkspace() {
  const [query, setQuery] = React.useState("");
  const [hits, setHits] = React.useState<UserHit[] | null>(null);
  const [searching, setSearching] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [selected, setSelected] = React.useState<string | null>(null);
  /** Último padre/maestro consultado: sus afiliados siguen a la vista mientras se revisa a cada uno. */
  const [tutor, setTutor] = React.useState<AdminUser | null>(null);

  const search = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setSearching(true);
    setError(null);
    try {
      setHits(await searchUsers(query));
      setTutor(null);
    } catch (err) {
      setError(messageOf(err, "No pudimos buscar usuarios."));
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader
        eyebrow="/admin/users"
        title="Usuarios y licencias"
        description="Busca por correo, nombre, apodo o ID. Desde la ficha cambias el tipo de usuario, otorgas, editas o quitas licencias y borras cuentas."
      />

      <form onSubmit={search} className="flex flex-col gap-2 sm:flex-row">
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="correo@ejemplo.com, nombre o ID"
          aria-label="Buscar usuario"
          className="h-11"
        />
        <Button type="submit" className="h-11" disabled={searching || query.trim().length < 3}>
          {searching ? <Loader2 className="animate-spin motion-reduce:animate-none" /> : <Search />} Buscar
        </Button>
      </form>
      {error && <ErrorLine text={error} />}

      <div className="grid items-start gap-6 lg:grid-cols-[22rem_1fr]">
        <section aria-label="Resultados" className="flex flex-col gap-2">
          {hits === null ? (
            <p className="rounded-2xl border bg-card p-5 text-sm text-muted-foreground">
              Escribe al menos 3 letras y pulsa Buscar. No cargamos la lista completa.
            </p>
          ) : hits.length === 0 ? (
            <p className="rounded-2xl border bg-card p-5 text-sm text-muted-foreground">Sin resultados.</p>
          ) : (
            <>
              <p className="text-xs text-muted-foreground">
                {hits.length === 50 ? "Primeros 50 resultados; afina la búsqueda." : `${hits.length} resultados`}
              </p>
              {hits.map((h) => (
                <button
                  key={h.id}
                  type="button"
                  onClick={() => setSelected(h.id)}
                  className={cn(
                    "flex flex-col gap-1 rounded-xl border bg-card p-3 text-left transition-colors hover:border-brand-light/50",
                    selected === h.id && "border-brand-light bg-primary/10"
                  )}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate font-semibold">{h.full_name || h.alias}</span>
                    <TypeBadge type={h.user_type} />
                  </span>
                  <span className="truncate text-xs text-muted-foreground">{h.email}</span>
                  <span className="text-xs">
                    {h.acceso ? (
                      <span className="text-success">
                        {planLabel(h.acceso.plan)} {h.acceso.propia ? "" : "(de su tutor) "}· vence {formatDay(h.acceso.expires_at)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">Sin licencia vigente</span>
                    )}
                  </span>
                </button>
              ))}
            </>
          )}
          {tutor && <Affiliates tutor={tutor} selected={selected} onSelect={setSelected} />}
        </section>

        {selected ? (
          <UserDetail
            key={selected}
            id={selected}
            onDeleted={() => {
              setHits((h) => h?.filter((x) => x.id !== selected) ?? null);
              if (tutor?.id === selected) setTutor(null);
              setSelected(null);
            }}
            onLoaded={(u) => {
              if (u.estudiantes.length > 0) setTutor(u);
              else if (!tutor?.estudiantes.some((s) => s.id === u.id)) setTutor(null);
            }}
            onChanged={() => hits && search()}
          />
        ) : (
          <p className="hidden rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground lg:block">
            Elige un usuario para ver su ficha.
          </p>
        )}
      </div>
    </div>
  );
}

function UserDetail({
  id,
  onDeleted,
  onChanged,
  onLoaded,
}: {
  id: string;
  onDeleted: () => void;
  onChanged: () => void;
  onLoaded: (user: AdminUser) => void;
}) {
  const { viewer } = useMode();
  const [user, setUser] = React.useState<AdminUser | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [type, setType] = React.useState<UserType>("student");
  const [savingType, setSavingType] = React.useState(false);
  const [editing, setEditing] = React.useState<AdminLicense | "new" | null>(null);
  const [removing, setRemoving] = React.useState<AdminLicense | null>(null);
  const [deleting, setDeleting] = React.useState(false);
  const self = viewer.id === id;

  const load = React.useCallback(async () => {
    try {
      const u = await getUser(id);
      setUser(u);
      setType(u.user_type);
      onLoaded(u);
    } catch (err) {
      setError(messageOf(err, "No pudimos cargar al usuario."));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onLoaded cambia en cada render del padre
  }, [id]);

  React.useEffect(() => {
    load();
  }, [load]);

  const refresh = async () => {
    await load();
    onChanged();
  };

  const saveType = async () => {
    setSavingType(true);
    setError(null);
    try {
      await changeUserType(id, type);
      await refresh();
    } catch (err) {
      setError(messageOf(err, "No pudimos cambiar el tipo de usuario."));
    } finally {
      setSavingType(false);
    }
  };

  if (!user) {
    return error ? (
      <ErrorLine text={error} />
    ) : (
      <div className="h-80 animate-pulse rounded-2xl bg-card motion-reduce:animate-none" aria-label="Cargando usuario" />
    );
  }

  return (
    <section aria-label="Ficha del usuario" className="flex flex-col gap-5 rounded-2xl border bg-card p-5 sm:p-6">
      <header className="flex flex-col gap-1">
        <h2 className="text-xl font-bold text-balance">{user.full_name || user.alias}</h2>
        <p className="text-sm break-all text-muted-foreground">
          {user.email} · apodo «{user.alias}»
        </p>
        <p className="font-mono text-xs break-all text-muted-foreground">{user.id}</p>
        <p className="text-xs text-muted-foreground">
          Alta {formatDay(user.created_at)}
          {user.ultimo_acceso && <> · último acceso {formatDay(user.ultimo_acceso)}</>} · {user.examenes} exámenes
          {user.estudiante && (
            <>
              {" "}
              · pruebas gratis {user.estudiante.free_exams_used}/{user.estudiante.free_exams_granted} (periodo hasta{" "}
              {formatDay(user.estudiante.free_trial_ends_at)})
            </>
          )}
        </p>
      </header>

      <div className="flex flex-col gap-2">
        <Label htmlFor="tipo">Tipo de usuario</Label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <NativeSelect id="tipo" value={type} disabled={self} onChange={(e) => setType(e.target.value as UserType)}>
            {USER_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </NativeSelect>
          <Button className="h-11" onClick={saveType} disabled={self || savingType || type === user.user_type}>
            {savingType && <Loader2 className="animate-spin motion-reduce:animate-none" />} Guardar tipo
          </Button>
        </div>
        {self && <p className="text-xs text-muted-foreground">Es tu cuenta: no puedes cambiar tu propio tipo.</p>}
      </div>

      {error && <ErrorLine text={error} />}

      <div className="flex flex-col gap-3 border-t pt-5">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-semibold">Licencias propias</h3>
          <Button size="sm" variant="secondary" onClick={() => setEditing("new")}>
            <Plus /> Otorgar licencia
          </Button>
        </div>
        {user.licencias.length === 0 ? (
          <p className="text-sm text-muted-foreground">No tiene licencias a su nombre.</p>
        ) : (
          user.licencias.map((l) => (
            <LicenseCard key={l.id} license={l} onEdit={() => setEditing(l)} onDelete={() => setRemoving(l)} />
          ))
        )}
      </div>

      {user.lugar && (
        <p className="rounded-xl border p-3 text-sm">
          <KeyRound className="mr-1.5 inline size-4 text-brand-light" />
          Ocupa un lugar en el {planLabel(user.lugar.plan)} de <strong>{user.lugar.dueno.alias}</strong> ({user.lugar.dueno.email}) ·{" "}
          {user.lugar.vigente ? `vence ${formatDay(user.lugar.expires_at)}` : "no vigente"}
        </p>
      )}

      {(user.tutores.length > 0 || user.estudiantes.length > 0) && (
        <div className="flex flex-col gap-1 border-t pt-5 text-sm">
          {user.tutores.length > 0 && (
            <p>
              <span className="text-muted-foreground">Tutores: </span>
              {user.tutores.map((t) => `${t.alias} (${t.email})`).join(", ")}
            </p>
          )}
          {user.estudiantes.length > 0 && (
            <p>
              <span className="text-muted-foreground">Estudiantes vinculados: </span>
              {user.estudiantes.map((s) => `${s.alias} (${s.email})`).join(", ")}
            </p>
          )}
        </div>
      )}

      <div className="flex flex-col gap-2 rounded-xl border border-destructive/40 p-4">
        <p className="text-sm font-semibold text-destructive">Zona de peligro</p>
        <p className="text-xs text-muted-foreground text-pretty">
          Borra la cuenta y todo lo suyo: metas, licencias, exámenes, planes y vínculos. No se puede deshacer.
        </p>
        <Button
          variant="outline"
          className="w-fit border-destructive/50 text-destructive hover:bg-destructive/10 hover:text-destructive"
          disabled={self}
          onClick={() => setDeleting(true)}
        >
          <UserX /> Borrar usuario
        </Button>
      </div>

      <LicenseDialog
        ownerId={user.id}
        license={editing}
        defaultPlan={user.user_type === "teacher" || user.user_type === "director" ? "school" : "individual"}
        onClose={() => setEditing(null)}
        onSaved={async () => {
          setEditing(null);
          await refresh();
        }}
      />

      <ConfirmDialog
        open={!!removing}
        title="¿Quitar esta licencia?"
        description={
          removing
            ? `${planLabel(removing.plan)} (${SOURCE_LABEL[removing.source]}). ${
                removing.ocupados.length
                  ? `${removing.ocupados.length} estudiante(s) pierden su lugar y vuelven al modo demo; su historial se conserva.`
                  : "No tiene lugares ocupados."
              }`
            : ""
        }
        confirmLabel="Quitar licencia"
        onClose={() => setRemoving(null)}
        onConfirm={async () => {
          await deleteLicense(removing!.id);
          setRemoving(null);
          await refresh();
        }}
      />

      <ConfirmDialog
        open={deleting}
        title={`¿Borrar a ${user.full_name || user.alias}?`}
        description="Se borra la cuenta de acceso y todos sus datos. Escribe su correo para confirmar."
        confirmText={user.email}
        confirmLabel="Borrar para siempre"
        onClose={() => setDeleting(false)}
        onConfirm={async () => {
          await deleteUser(user.id);
          setDeleting(false);
          onDeleted();
        }}
      />
    </section>
  );
}

/** Estudiantes vinculados al padre/maestro consultado: un botón por cuenta para abrir su ficha. */
function Affiliates({ tutor, selected, onSelect }: { tutor: AdminUser; selected: string | null; onSelect: (id: string) => void }) {
  const seated = new Set(tutor.licencias.filter((l) => l.vigente).flatMap((l) => l.ocupados.map((o) => o.id)));
  return (
    <div className="mt-4 flex flex-col gap-2 border-t pt-4">
      <p className="text-xs text-muted-foreground">
        Afiliados de <strong className="text-foreground">{tutor.full_name || tutor.alias}</strong> ({tutor.estudiantes.length})
      </p>
      {tutor.estudiantes.map((s) => (
        <button
          key={s.id}
          type="button"
          onClick={() => onSelect(s.id)}
          className={cn(
            "flex flex-col gap-1 rounded-xl border bg-card p-3 text-left transition-colors hover:border-brand-light/50",
            selected === s.id && "border-brand-light bg-primary/10"
          )}
        >
          <span className="flex items-center justify-between gap-2">
            <span className="truncate font-semibold">{s.alias}</span>
            <TypeBadge type="student" />
          </span>
          <span className="truncate text-xs text-muted-foreground">{s.email}</span>
          <span className={cn("text-xs", seated.has(s.id) ? "text-success" : "text-muted-foreground")}>
            {seated.has(s.id) ? "Ocupa un lugar de su licencia" : "Sin lugar en su licencia"}
          </span>
        </button>
      ))}
    </div>
  );
}

function LicenseCard({ license: l, onEdit, onDelete }: { license: AdminLicense; onEdit: () => void; onDelete: () => void }) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-semibold">
          {planLabel(l.plan)} · {l.ocupados.length}/{l.seats} lugares
        </span>
        <span
          className={cn(
            "rounded-full px-2.5 py-0.5 text-xs font-semibold",
            l.vigente ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"
          )}
        >
          {l.vigente ? "Vigente" : l.status === "inactive" ? "Inactiva" : "Vencida"}
        </span>
      </div>
      <p className="text-xs text-muted-foreground">
        {SOURCE_LABEL[l.source]}
        {l.coupon_code && ` ${l.coupon_code}`} · {formatDay(l.starts_at)} → {formatDay(l.expires_at)}
        {l.granted_reason && <> · «{l.granted_reason}»</>}
      </p>
      {l.ocupados.length > 0 && (
        <p className="text-xs">
          <span className="text-muted-foreground">Ocupan: </span>
          {l.ocupados.map((o) => `${o.alias} (${o.email})`).join(", ")}
        </p>
      )}
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={onEdit}>
          <Pencil /> Editar
        </Button>
        <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={onDelete}>
          <Trash2 /> Quitar
        </Button>
      </div>
    </div>
  );
}

const toDateInput = (iso: string) => iso.slice(0, 10);
const endOfDay = (date: string) => new Date(`${date}T23:59:59`).toISOString();

/** Otorgar (license = "new") o editar una licencia. */
function LicenseDialog({
  ownerId,
  license,
  defaultPlan,
  onClose,
  onSaved,
}: {
  ownerId: string;
  license: AdminLicense | "new" | null;
  defaultPlan: LicensePlan;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isNew = license === "new";
  const [plan, setPlan] = React.useState<LicensePlan>(defaultPlan);
  const [seats, setSeats] = React.useState(1);
  const [days, setDays] = React.useState(30);
  const [expires, setExpires] = React.useState("");
  const [status, setStatus] = React.useState<AdminLicense["status"]>("active");
  const [reason, setReason] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!license) return;
    setError(null);
    if (license === "new") {
      setPlan(defaultPlan);
      setSeats(LICENSE_PLANS.find((p) => p.value === defaultPlan)!.seats);
      setDays(30);
      setReason("");
    } else {
      setPlan(license.plan);
      setSeats(license.seats);
      setExpires(toDateInput(license.expires_at));
      setStatus(license.status);
      setReason(license.granted_reason ?? "");
    }
  }, [license, defaultPlan]);

  const choosePlan = (p: LicensePlan) => {
    setPlan(p);
    if (isNew) setSeats(LICENSE_PLANS.find((x) => x.value === p)!.seats);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (license === "new") await grantLicense(ownerId, { plan, seats, days, reason });
      else if (license) await updateLicense(license.id, { plan, seats, expiresAt: endOfDay(expires), status, reason });
      onSaved();
    } catch (err) {
      setError(messageOf(err, "No pudimos guardar la licencia."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={!!license} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isNew ? "Otorgar licencia" : "Editar licencia"}</DialogTitle>
          <DialogDescription>
            {isNew
              ? "Licencia de cortesía. Si es estudiante ocupa su propio lugar; si es padre o maestro, sus estudiantes vinculados ocupan los lugares."
              : "Los lugares no pueden bajar de los ya ocupados."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={save} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="plan">Tipo de licencia</Label>
            <NativeSelect id="plan" value={plan} onChange={(e) => choosePlan(e.target.value as LicensePlan)}>
              {LICENSE_PLANS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="seats">Lugares (estudiantes)</Label>
              <Input
                id="seats"
                type="number"
                min={1}
                max={10000}
                step={1}
                required
                value={seats}
                onChange={(e) => setSeats(Math.trunc(Number(e.target.value)))}
              />
            </div>
            {isNew ? (
              <div className="flex flex-col gap-2">
                <Label htmlFor="days">Duración (días)</Label>
                <Input
                  id="days"
                  type="number"
                  min={1}
                  max={3650}
                  step={1}
                  required
                  value={days}
                  onChange={(e) => setDays(Math.trunc(Number(e.target.value)))}
                />
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <Label htmlFor="expires">Vence el</Label>
                <Input id="expires" type="date" required value={expires} onChange={(e) => setExpires(e.target.value)} />
              </div>
            )}
          </div>
          {!isNew && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="status">Estado</Label>
              <NativeSelect id="status" value={status} onChange={(e) => setStatus(e.target.value as AdminLicense["status"])}>
                <option value="active">Activa</option>
                <option value="inactive">Inactiva (suspendida)</option>
              </NativeSelect>
            </div>
          )}
          <div className="flex flex-col gap-2">
            <Label htmlFor="reason">Motivo («Gratis por:»)</Label>
            <Input
              id="reason"
              required={isNew}
              maxLength={120}
              value={reason}
              placeholder="Ej. Prueba con grupo de enfoque"
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
          {error && <ErrorLine text={error} />}
          <Button type="submit" disabled={saving}>
            {saving && <Loader2 className="animate-spin motion-reduce:animate-none" />} {isNew ? "Otorgar" : "Guardar cambios"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ConfirmDialog({
  open,
  title,
  description,
  confirmText,
  confirmLabel,
  onClose,
  onConfirm,
}: {
  open: boolean;
  title: string;
  description: string;
  /** Si se da, hay que escribirlo tal cual para habilitar el botón. */
  confirmText?: string;
  confirmLabel: string;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}) {
  const [typed, setTyped] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open) {
      setTyped("");
      setError(null);
    }
  }, [open]);

  const confirm = async () => {
    setBusy(true);
    setError(null);
    try {
      await onConfirm();
    } catch (err) {
      setError(messageOf(err, "No se pudo completar."));
    } finally {
      setBusy(false);
    }
  };

  const ready = !confirmText || typed.trim().toLowerCase() === confirmText.toLowerCase();

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {confirmText && (
          <Input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={confirmText} aria-label="Confirmación" />
        )}
        {error && <ErrorLine text={error} />}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            variant="outline"
            className="border-destructive/50 text-destructive hover:bg-destructive/10 hover:text-destructive"
            disabled={!ready || busy}
            onClick={confirm}
          >
            {busy ? <Loader2 className="animate-spin motion-reduce:animate-none" /> : <Trash2 />} {confirmLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function TypeBadge({ type }: { type: UserType }) {
  return (
    <span
      className={cn(
        "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold",
        type === "admin" ? "bg-gold/15 text-gold" : type === "student" ? "bg-secondary/15 text-secondary" : "bg-primary/15 text-brand-light"
      )}
    >
      {userTypeLabel(type)}
    </span>
  );
}

function ErrorLine({ text }: { text: string }) {
  return (
    <p role="alert" className="flex items-center gap-2 text-sm text-destructive">
      <CircleAlert className="size-4 shrink-0" /> {text}
    </p>
  );
}
