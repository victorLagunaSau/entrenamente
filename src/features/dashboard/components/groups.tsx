"use client";

import * as React from "react";
import { Check, ChevronDown, CircleAlert, Pencil, Plus, Tags, Trash2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

import { TUTOR_COPY } from "../lib/tutor-plans";
import { assignGroup, createGroup, deleteGroup, errorMessage, renameGroup, type TutorGroup } from "../services/tutor-service";
import { useTutor } from "./tutor-context";

/** Filtro de la lista: todos, un grupo o los que no tienen grupo. */
export type GroupFilter = "all" | "none" | number;

/** Chips de grupos (filtran la lista) + "Administrar grupos". */
export function GroupChips({ value, onChange }: { value: GroupFilter; onChange: (v: GroupFilter) => void }) {
  const { panel } = useTutor();
  const groups = panel?.groups ?? [];
  const students = panel?.students ?? [];
  const [open, setOpen] = React.useState(false);
  const count = (g: GroupFilter) =>
    g === "all" ? students.length : students.filter((s) => (g === "none" ? s.groupId === null : s.groupId === g)).length;

  const chips: { id: GroupFilter; label: string }[] = [
    { id: "all", label: "Todos" },
    ...groups.map((g) => ({ id: g.id as GroupFilter, label: g.name })),
    ...(groups.length > 0 ? [{ id: "none" as GroupFilter, label: "Sin grupo" }] : []),
  ];

  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filtrar por grupo">
      {chips.map((c) => (
        <button
          key={String(c.id)}
          type="button"
          aria-pressed={value === c.id}
          onClick={() => onChange(c.id)}
          className={cn(
            "inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-sm transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
            value === c.id ? "border-secondary/50 bg-secondary/15 text-foreground" : "text-cool hover:bg-accent"
          )}
        >
          {c.label}
          <span className="text-xs text-muted-foreground tabular-nums">{count(c.id)}</span>
        </button>
      ))}
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)} className="h-9">
        <Tags /> {groups.length ? "Administrar grupos" : "Crear grupos"}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>{open && <GroupsManager />}</DialogContent>
      </Dialog>
    </div>
  );
}

function GroupsManager() {
  const { kind, panel, reload } = useTutor();
  const groups = panel?.groups ?? [];
  const [name, setName] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError("");
    try {
      await fn();
      await reload();
      return true;
    } catch (e) {
      setError(errorMessage(e));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    if (await run(() => createGroup(name.trim()))) setName("");
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Grupos</DialogTitle>
        <DialogDescription>
          Etiquetas para organizar a {TUTOR_COPY[kind].students}. Borrar un grupo no desvincula a nadie.
        </DialogDescription>
      </DialogHeader>

      <form onSubmit={create} className="flex gap-2">
        <Input
          aria-label="Nombre del grupo nuevo"
          placeholder={TUTOR_COPY[kind].groupsHint}
          value={name}
          maxLength={40}
          onChange={(e) => setName(e.target.value)}
        />
        <Button type="submit" disabled={busy || !name.trim()} className="h-11 shrink-0">
          <Plus /> Crear
        </Button>
      </form>

      {error && (
        <p role="alert" className="flex items-center gap-2 text-sm text-destructive">
          <CircleAlert className="size-4 shrink-0" /> {error}
        </p>
      )}

      {groups.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aún no tienes grupos.</p>
      ) : (
        <ul className="flex flex-col divide-y rounded-xl border">
          {groups.map((g) => (
            <GroupRow key={g.id} group={g} busy={busy} run={run} />
          ))}
        </ul>
      )}
    </>
  );
}

function GroupRow({
  group,
  busy,
  run,
}: {
  group: TutorGroup;
  busy: boolean;
  run: (fn: () => Promise<unknown>) => Promise<boolean>;
}) {
  const { panel } = useTutor();
  const [editing, setEditing] = React.useState(false);
  const [name, setName] = React.useState(group.name);
  const members = panel?.students.filter((s) => s.groupId === group.id).length ?? 0;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || name.trim() === group.name) return setEditing(false);
    if (await run(() => renameGroup(group.id, name.trim()))) setEditing(false);
  };

  if (editing) {
    return (
      <li className="p-2">
        <form onSubmit={save} className="flex gap-2">
          <Input aria-label="Nuevo nombre" value={name} maxLength={40} autoFocus onChange={(e) => setName(e.target.value)} />
          <Button type="submit" size="icon" className="size-11 shrink-0" disabled={busy} aria-label="Guardar nombre">
            <Check />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-11 shrink-0"
            aria-label="Cancelar"
            onClick={() => {
              setName(group.name);
              setEditing(false);
            }}
          >
            <X />
          </Button>
        </form>
      </li>
    );
  }

  return (
    <li className="flex items-center gap-2 py-2 pr-2 pl-4">
      <span className="min-w-0 flex-1 truncate font-medium">{group.name}</span>
      <span className="text-xs text-muted-foreground tabular-nums">
        {members} {members === 1 ? "estudiante" : "estudiantes"}
      </span>
      <Button variant="ghost" size="icon" className="size-9" aria-label={`Renombrar ${group.name}`} onClick={() => setEditing(true)}>
        <Pencil />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="size-9 hover:text-destructive"
        aria-label={`Borrar ${group.name}`}
        disabled={busy}
        onClick={() => run(() => deleteGroup(group.id))}
      >
        <Trash2 />
      </Button>
    </li>
  );
}

/** Selector de grupo dentro de cada estudiante: cambia al instante y confirma con el servidor. */
export function GroupSelect({ studentId, groupId, label }: { studentId: string; groupId: number | null; label: string }) {
  const { panel, patch, reload } = useTutor();
  const groups = panel?.groups ?? [];
  const [error, setError] = React.useState(false);

  const change = async (value: string) => {
    const next = value === "" ? null : Number(value);
    setError(false);
    patch((p) => ({ ...p, students: p.students.map((s) => (s.id === studentId ? { ...s, groupId: next } : s)) }));
    try {
      await assignGroup(studentId, next);
    } catch {
      setError(true);
      await reload();
    }
  };

  return (
    <div className="relative">
      <select
        aria-label={label}
        aria-invalid={error || undefined}
        value={groupId ?? ""}
        onChange={(e) => change(e.target.value)}
        disabled={groups.length === 0}
        className={cn(
          "h-9 w-full min-w-36 appearance-none rounded-md border border-input bg-background/60 pr-8 pl-3 text-sm text-foreground outline-none",
          "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:opacity-50",
          error && "border-destructive"
        )}
      >
        <option value="">{groups.length ? "Sin grupo" : "Crea un grupo primero"}</option>
        {groups.map((g) => (
          <option key={g.id} value={g.id}>
            {g.name}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
    </div>
  );
}
