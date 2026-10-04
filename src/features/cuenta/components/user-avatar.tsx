/* eslint-disable @next/next/no-img-element -- fotos de Storage con export estático (sin next/image) */
import { cn } from "@/lib/utils";

import { findPreset } from "../lib/profile";

/** Foto subida, avatar de ejemplo ("preset:<id>") o la inicial del apodo. */
export function UserAvatar({
  avatarUrl,
  alias,
  className,
}: {
  avatarUrl: string | null | undefined;
  alias: string;
  className?: string;
}) {
  const base = cn("grid size-10 shrink-0 place-items-center overflow-hidden rounded-full", className);
  const preset = findPreset(avatarUrl);

  if (preset?.src) return <img src={preset.src} alt="" className={cn(base, "object-cover")} />;
  if (preset) {
    const Icon = preset.icon;
    return (
      <span
        className={cn(base, "text-white")}
        style={{ backgroundImage: `linear-gradient(135deg, ${preset.from}, ${preset.to})` }}
        aria-hidden
      >
        <Icon className="size-[55%]" />
      </span>
    );
  }
  if (avatarUrl) return <img src={avatarUrl} alt="" className={cn(base, "object-cover")} />;
  return (
    <span className={cn(base, "border bg-card font-display font-bold text-brand-light")} aria-hidden>
      {alias.trim().charAt(0).toUpperCase() || "?"}
    </span>
  );
}
