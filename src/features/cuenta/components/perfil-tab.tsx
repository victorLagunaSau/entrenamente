"use client";

import * as React from "react";
import Link from "next/link";
import {
  Camera,
  ChevronRight,
  GraduationCap,
  IdCard,
  Loader2,
  Lock,
  Save,
  ShieldCheck,
  Upload,
  UserRound,
  Users,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MY_CAREERS_PATH } from "@/features/student/services/student-goals-service";
import { cn } from "@/lib/utils";

import {
  ADULT_AGE,
  ageFrom,
  AVATAR_MAX_INPUT_MB,
  AVATAR_MIN_SIDE,
  AVATAR_PRESETS,
  AVATAR_TYPES,
  ESTADOS,
  GRADOS,
  isValidPhone,
  normalizePhone,
  PRESET_PREFIX,
  USER_TYPE_LABELS,
} from "../lib/profile";
import { CuentaError, savePerfil, setAvatar, uploadAvatar, removeUploadedAvatars } from "../services/cuenta-service";
import type { CuentaContext } from "./cuenta-page";
import { Field, FormMessage, Section, selectClass } from "./parts";
import { UserAvatar } from "./user-avatar";

const dateFmt = new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "long", year: "numeric" });

const message = (e: unknown) => (e instanceof CuentaError ? e.message : "Algo salió mal. Intenta de nuevo.");

export function PerfilTab({ cuenta, providers, reload }: CuentaContext) {
  return (
    <div className="flex flex-col gap-4">
      <AvatarSection cuenta={cuenta} providers={providers} reload={reload} />
      <DatosSection cuenta={cuenta} providers={providers} reload={reload} />
      {cuenta.userType === "student" && <StudentSection cuenta={cuenta} />}
      {(cuenta.userType === "parent" || cuenta.userType === "teacher") && <TutorSection cuenta={cuenta} />}
      <AccountSection cuenta={cuenta} providers={providers} />
    </div>
  );
}

function AvatarSection({ cuenta, reload }: CuentaContext) {
  const fileRef = React.useRef<HTMLInputElement>(null);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [error, setError] = React.useState("");

  const run = async (key: string, task: () => Promise<unknown>) => {
    setBusy(key);
    setError("");
    try {
      await task();
      await reload();
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(null);
    }
  };

  const choosePreset = (id: string) =>
    run(id, async () => {
      await setAvatar(`${PRESET_PREFIX}${id}`);
      await removeUploadedAvatars(cuenta.id).catch(() => undefined);
    });

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) run("upload", () => uploadAvatar(cuenta.id, file));
  };

  const remove = () =>
    run("remove", async () => {
      await setAvatar(null);
      await removeUploadedAvatars(cuenta.id).catch(() => undefined);
    });

  const isUpload = !!cuenta.avatarUrl && !cuenta.avatarUrl.startsWith(PRESET_PREFIX);

  return (
    <Section icon={Camera} title="Foto de perfil" description="Elige un avatar o sube tu foto. Se ve en tu menú de cuenta.">
      <div className="flex flex-wrap items-center gap-4">
        <UserAvatar avatarUrl={cuenta.avatarUrl} alias={cuenta.alias} className="size-20 text-2xl" />
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" disabled={!!busy} onClick={() => fileRef.current?.click()}>
            {busy === "upload" ? <Loader2 className="animate-spin" /> : <Upload />} Subir foto
          </Button>
          {cuenta.avatarUrl && (
            <Button variant="ghost" size="sm" disabled={!!busy} onClick={remove}>
              {busy === "remove" ? <Loader2 className="animate-spin" /> : <X />} Quitar
            </Button>
          )}
        </div>
        <input ref={fileRef} type="file" accept={AVATAR_TYPES.join(",")} className="sr-only" onChange={onFile} tabIndex={-1} />
      </div>
      <p className="text-xs text-muted-foreground">
        JPG, PNG o WebP · hasta {AVATAR_MAX_INPUT_MB} MB · mínimo {AVATAR_MIN_SIDE} × {AVATAR_MIN_SIDE} px. La recortamos en
        cuadrado y la optimizamos antes de guardarla.
        {isUpload && " Tu foto actual es la que subiste."}
      </p>

      <fieldset>
        <legend className="mb-2 text-sm font-semibold">Avatares</legend>
        <div className="flex flex-wrap gap-2">
          {AVATAR_PRESETS.map((p) => {
            const active = cuenta.avatarUrl === `${PRESET_PREFIX}${p.id}`;
            return (
              <button
                key={p.id}
                type="button"
                aria-pressed={active}
                aria-label={`Avatar ${p.label}`}
                disabled={!!busy}
                onClick={() => choosePreset(p.id)}
                className={cn(
                  "relative rounded-full p-0.5 ring-2 transition-all focus-visible:ring-ring/60 focus-visible:outline-none disabled:opacity-60",
                  active ? "ring-secondary" : "ring-transparent hover:ring-border"
                )}
              >
                <UserAvatar avatarUrl={`${PRESET_PREFIX}${p.id}`} alias={cuenta.alias} className="size-12" />
                {busy === p.id && (
                  <span className="absolute inset-0 grid place-items-center rounded-full bg-background/60">
                    <Loader2 className="size-5 animate-spin" />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </fieldset>
      <FormMessage error={error} />
    </Section>
  );
}

function DatosSection({ cuenta, reload }: CuentaContext) {
  const student = cuenta.userType === "student";
  const [fullName, setFullName] = React.useState(cuenta.fullName);
  const [alias, setAlias] = React.useState(cuenta.alias);
  const [birthDate, setBirthDate] = React.useState(cuenta.birthDate ?? "");
  const [phone, setPhone] = React.useState(cuenta.phone ?? "");
  const [estado, setEstado] = React.useState(cuenta.estado ?? "");
  const [originSchool, setOriginSchool] = React.useState(cuenta.student?.originSchool ?? "");
  const [notStudying, setNotStudying] = React.useState(cuenta.student?.notStudying ?? false);
  const [grado, setGrado] = React.useState(cuenta.student?.grado ?? "");
  const [promedio, setPromedio] = React.useState(cuenta.student?.promedio?.toString() ?? "");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState("");
  const [saved, setSaved] = React.useState(false);

  const age = ageFrom(birthDate || null);
  const adult = age !== null && age >= ADULT_AGE;
  const today = new Date().toISOString().slice(0, 10);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSaved(false);
    const cleanPhone = normalizePhone(phone);
    if (adult && cleanPhone && !isValidPhone(cleanPhone)) return setError("El teléfono debe tener 10 dígitos (o lada internacional).");
    const avg = promedio.trim() ? Number(promedio) : null;
    if (avg !== null && (Number.isNaN(avg) || avg < 5 || avg > 10)) return setError("El promedio va de 5 a 10.");

    setSaving(true);
    try {
      await savePerfil({
        fullName,
        alias,
        birthDate: birthDate || null,
        phone: adult && cleanPhone ? cleanPhone : null,
        estado: estado || null,
        originSchool: student && !notStudying ? originSchool : null,
        notStudying: student && notStudying,
        grado: student ? grado || null : null,
        promedio: student ? avg : null,
      });
      await reload();
      setSaved(true);
    } catch (err) {
      setError(message(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Section icon={IdCard} title="Datos personales" description="Nos ayudan a personalizar tu entrenamiento. Solo tú (y tu tutor, si tienes) los ven.">
      <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
        <Field label="Nombre completo" htmlFor="full-name">
          <Input id="full-name" value={fullName} onChange={(e) => setFullName(e.target.value)} required minLength={2} maxLength={80} autoComplete="name" />
        </Field>
        <Field label="Apodo" htmlFor="alias" hint="Así te saludamos en la app.">
          <Input id="alias" value={alias} onChange={(e) => setAlias(e.target.value)} maxLength={30} autoComplete="nickname" />
        </Field>
        <Field
          label="Correo electrónico"
          htmlFor="email"
          className="sm:col-span-2"
          hint={
            <span className="inline-flex items-center gap-1">
              <Lock className="size-3" aria-hidden /> Es tu usuario para entrar; no se puede cambiar.
            </span>
          }
        >
          <Input id="email" value={cuenta.email} readOnly disabled />
        </Field>
        <Field label="Fecha de nacimiento" htmlFor="birth" hint={age !== null ? `${age} años` : "Opcional"}>
          <Input id="birth" type="date" value={birthDate} max={today} min="1925-01-01" onChange={(e) => setBirthDate(e.target.value)} />
        </Field>
        <Field label="Estado" htmlFor="estado">
          <select id="estado" value={estado} onChange={(e) => setEstado(e.target.value)} className={selectClass}>
            <option value="">Sin especificar</option>
            {ESTADOS.map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
          </select>
        </Field>
        {adult ? (
          <Field label="Teléfono" htmlFor="phone" hint="Opcional · 10 dígitos. Solo para avisos importantes de tu cuenta." className="sm:col-span-2">
            <Input id="phone" type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={16} autoComplete="tel" placeholder="55 1234 5678" />
          </Field>
        ) : (
          <p className="rounded-xl bg-muted/50 p-3 text-xs text-muted-foreground sm:col-span-2">
            El teléfono solo se pide a mayores de {ADULT_AGE} años{age === null ? ": agrega tu fecha de nacimiento para habilitarlo." : "."}
            {age !== null && student && " Los avisos llegan a tu tutor."}
          </p>
        )}

        {student && (
          <>
            <h3 className="mt-2 text-sm font-semibold sm:col-span-2">Datos escolares</h3>
            <Field label="Grado actual" htmlFor="grado">
              <select id="grado" value={grado} onChange={(e) => setGrado(e.target.value)} className={selectClass}>
                <option value="">Sin especificar</option>
                {GRADOS.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Promedio" htmlFor="promedio" hint="De 5 a 10. Algunas universidades lo piden para el pase.">
              <Input id="promedio" type="number" inputMode="decimal" step="0.1" min={5} max={10} value={promedio} onChange={(e) => setPromedio(e.target.value)} placeholder="9.2" />
            </Field>
            <Field label="Escuela de procedencia" htmlFor="school" className="sm:col-span-2">
              <Input id="school" value={notStudying ? "" : originSchool} disabled={notStudying} onChange={(e) => setOriginSchool(e.target.value)} maxLength={120} placeholder="Ej. CCH Sur, Prepa 6, CBTis 52" />
            </Field>
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <input type="checkbox" checked={notStudying} onChange={(e) => setNotStudying(e.target.checked)} className="size-4 accent-[var(--secondary)]" />
              No estoy estudiando actualmente
            </label>
          </>
        )}

        <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
          <Button type="submit" variant="brand" disabled={saving}>
            {saving ? <Loader2 className="animate-spin" /> : <Save />} Guardar cambios
          </Button>
          <FormMessage error={error} success={saved ? "Cambios guardados." : undefined} />
        </div>
      </form>
    </Section>
  );
}

function StudentSection({ cuenta }: Pick<CuentaContext, "cuenta">) {
  return (
    <Section icon={GraduationCap} title="Mis metas y mi tutor">
      <Link
        href={MY_CAREERS_PATH}
        className="flex items-center gap-3 rounded-xl border bg-background/40 p-4 transition-colors hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <GraduationCap className="size-5 text-brand-light" aria-hidden />
        <span className="flex-1 text-sm font-medium">Mis carreras</span>
        <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
      </Link>
      <div className="flex items-center gap-3 rounded-xl border bg-background/40 p-4 text-sm">
        <Users className="size-5 text-secondary" aria-hidden />
        {cuenta.tutores.length > 0 ? (
          <span>
            Te acompaña{cuenta.tutores.length > 1 ? "n" : ""}{" "}
            {cuenta.tutores.map((t) => `${t.alias} (${USER_TYPE_LABELS[t.userType] ?? t.userType})`).join(", ")}: ve tu avance y tus
            resultados.
          </span>
        ) : (
          <span className="text-muted-foreground">Aún no tienes un tutor vinculado. Si tu mamá, papá o maestro te invita, aparecerá aquí.</span>
        )}
      </div>
    </Section>
  );
}

function TutorSection({ cuenta }: Pick<CuentaContext, "cuenta">) {
  return (
    <Section icon={Users} title="Mis estudiantes">
      <Link
        href="/app/dashboard"
        className="flex items-center gap-3 rounded-xl border bg-background/40 p-4 transition-colors hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <UserRound className="size-5 text-brand-light" aria-hidden />
        <span className="flex-1 text-sm font-medium">
          {cuenta.estudiantes === 0
            ? "Aún no tienes estudiantes vinculados"
            : `${cuenta.estudiantes} ${cuenta.estudiantes === 1 ? "estudiante vinculado" : "estudiantes vinculados"}`}
        </span>
        <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
      </Link>
      {cuenta.licenciaPropia && (
        <p className="text-sm text-cool">
          Plan activo con {cuenta.licenciaPropia.seats} {cuenta.licenciaPropia.seats === 1 ? "lugar" : "lugares"} hasta el{" "}
          {dateFmt.format(new Date(cuenta.licenciaPropia.expiresAt))}.
        </p>
      )}
    </Section>
  );
}

function AccountSection({ cuenta, providers }: Pick<CuentaContext, "cuenta" | "providers">) {
  const methods = [providers.includes("email") && "correo y contraseña", providers.includes("google") && "Google"].filter(Boolean);
  return (
    <Section icon={ShieldCheck} title="Tu cuenta">
      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs text-muted-foreground">Tipo de perfil</dt>
          <dd className="font-medium">{USER_TYPE_LABELS[cuenta.userType] ?? cuenta.userType}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Entras con</dt>
          <dd className="font-medium">{methods.length > 0 ? methods.join(" y ") : "correo"}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Miembro desde</dt>
          <dd className="font-medium">{dateFmt.format(new Date(cuenta.createdAt))}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Aviso de privacidad</dt>
          <dd className="font-medium">
            {cuenta.privacyAcceptedAt ? `Aceptado el ${dateFmt.format(new Date(cuenta.privacyAcceptedAt))}` : "Sin registro"}
          </dd>
        </div>
      </dl>
    </Section>
  );
}
