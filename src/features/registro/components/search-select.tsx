"use client";

import * as React from "react";
import { Check, ChevronDown, Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

import { invalidClass } from "./form-field";

export type SearchOption = { id: string; label: string; detail?: string };

const normalize = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();

/**
 * Combobox accesible (patrón ARIA 1.2) con búsqueda sin acentos.
 * Con `allowFreeText` acepta valores fuera del catálogo (id = null).
 */
export function SearchSelect({
  options,
  value,
  onChange,
  onBlur,
  allowFreeText,
  placeholder,
  emptyText = "Sin coincidencias",
  disabled,
  ...a11y
}: {
  options: SearchOption[];
  value: { id: string | null; label: string } | null;
  onChange: (value: { id: string | null; label: string } | null) => void;
  onBlur?: () => void;
  allowFreeText?: boolean;
  placeholder?: string;
  emptyText?: string;
  disabled?: boolean;
  id: string;
  "aria-invalid": boolean;
  "aria-describedby"?: string;
}) {
  const listId = `${a11y.id}-list`;
  const [query, setQuery] = React.useState(value?.label ?? "");
  const [open, setOpen] = React.useState(false);
  const [active, setActive] = React.useState(0);
  const listRef = React.useRef<HTMLUListElement>(null);

  // Sincroniza el texto cuando el valor cambia desde fuera (p. ej. al cambiar de universidad).
  React.useEffect(() => setQuery(value?.label ?? ""), [value?.label]);

  const filtered = React.useMemo(() => {
    const q = normalize(query);
    // Con una opción elegida y sin editar, se muestra la lista completa.
    if (!q || query === value?.label) return options;
    return options.filter((o) => normalize(`${o.label} ${o.detail ?? ""} ${o.id}`).includes(q));
  }, [options, query, value?.label]);

  React.useEffect(() => {
    listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const select = (o: SearchOption) => {
    onChange({ id: o.id, label: o.label });
    setQuery(o.label);
    setOpen(false);
  };

  const commitText = () => {
    const text = query.trim();
    if (text === (value?.label ?? "")) return;
    const exact = options.find((o) => normalize(o.label) === normalize(text));
    if (exact) return select(exact);
    if (!text) return onChange(null);
    if (allowFreeText) onChange({ id: null, label: text });
    else setQuery(value?.label ?? "");
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) return setOpen(true);
      const delta = e.key === "ArrowDown" ? 1 : -1;
      setActive((i) => (i + delta + filtered.length) % Math.max(filtered.length, 1));
    } else if (e.key === "Enter" && open) {
      // Evita que Enter envíe el paso mientras la lista está abierta.
      e.preventDefault();
      if (filtered[active]) select(filtered[active]);
      else {
        commitText();
        setOpen(false);
      }
    } else if (e.key === "Escape" && open) {
      e.preventDefault();
      setOpen(false);
    }
  };

  const showList = open && !disabled;

  return (
    <div className="relative">
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
      <Input
        {...a11y}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={showList}
        aria-controls={listId}
        aria-activedescendant={showList && filtered[active] ? `${listId}-${active}` : undefined}
        autoComplete="off"
        disabled={disabled}
        placeholder={placeholder}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(0);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onClick={() => setOpen(true)}
        onBlur={() => {
          commitText();
          setOpen(false);
          onBlur?.();
        }}
        onKeyDown={onKeyDown}
        className={cn("pr-10 pl-9", invalidClass)}
      />
      <ChevronDown
        aria-hidden
        className={cn(
          "pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground transition-transform",
          showList && "rotate-180"
        )}
      />

      {showList && (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          className="absolute inset-x-0 top-full z-20 mt-2 max-h-60 overflow-y-auto rounded-xl border bg-popover p-1 shadow-2xl animate-in fade-in-0 zoom-in-95 motion-reduce:animate-none"
        >
          {filtered.length === 0 ? (
            <li className="px-3 py-3 text-sm text-muted-foreground">
              {allowFreeText && query.trim() ? (
                <>
                  Usaremos «<span className="text-foreground">{query.trim()}</span>» tal como lo escribiste.
                </>
              ) : (
                emptyText
              )}
            </li>
          ) : (
            filtered.map((o, i) => {
              const selected = value?.id === o.id;
              return (
                <li
                  key={o.id}
                  id={`${listId}-${i}`}
                  data-index={i}
                  role="option"
                  aria-selected={selected}
                  // mousedown evita que el blur del input cierre la lista antes del click.
                  onMouseDown={(e) => {
                    e.preventDefault();
                    select(o);
                  }}
                  onMouseMove={() => setActive(i)}
                  className={cn(
                    "flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm",
                    i === active ? "bg-accent text-foreground" : "text-cool"
                  )}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{o.label}</span>
                    {o.detail && <span className="block truncate text-xs text-muted-foreground">{o.detail}</span>}
                  </span>
                  {selected && <Check className="size-4 shrink-0 text-secondary" />}
                </li>
              );
            })
          )}
        </ul>
      )}
    </div>
  );
}
