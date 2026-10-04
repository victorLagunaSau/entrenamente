/**
 * Catálogos y reglas del perfil. Los avatares de ejemplo se guardan como "preset:<id>" en profiles.avatar_url;
 * cuando existan las ilustraciones definitivas basta con darles `src` (o reemplazar esta lista).
 */

import type { LucideIcon } from "lucide-react";
import { Atom, BookOpen, Brain, Flame, Lightbulb, Rocket, Star, Trophy } from "lucide-react";

/** `from`/`to`: tokens de la guía de estilo (globals.css) para el degradado del fondo. */
export type AvatarPreset = { id: string; label: string; icon: LucideIcon; from: string; to: string; src?: string };

export const AVATAR_PRESETS: AvatarPreset[] = [
  { id: "cerebro", label: "Cerebro", icon: Brain, from: "var(--secondary)", to: "var(--primary)" },
  { id: "cohete", label: "Cohete", icon: Rocket, from: "var(--energy)", to: "var(--gold)" },
  { id: "atomo", label: "Átomo", icon: Atom, from: "var(--brand-light)", to: "var(--brand-mid)" },
  { id: "libro", label: "Libro", icon: BookOpen, from: "var(--primary)", to: "var(--brand-mid)" },
  { id: "fuego", label: "Fuego", icon: Flame, from: "var(--energy)", to: "var(--primary)" },
  { id: "estrella", label: "Estrella", icon: Star, from: "var(--gold)", to: "var(--secondary)" },
  { id: "trofeo", label: "Trofeo", icon: Trophy, from: "var(--gold)", to: "var(--energy)" },
  { id: "idea", label: "Idea", icon: Lightbulb, from: "var(--secondary)", to: "var(--gold)" },
];

export const PRESET_PREFIX = "preset:";

export const findPreset = (avatarUrl: string | null | undefined) =>
  avatarUrl?.startsWith(PRESET_PREFIX) ? (AVATAR_PRESETS.find((p) => `${PRESET_PREFIX}${p.id}` === avatarUrl) ?? null) : null;

/** Foto subida: el archivo original puede pesar hasta esto; se recorta y se reduce antes de subir. */
export const AVATAR_MAX_INPUT_MB = 5;
export const AVATAR_MIN_SIDE = 128;
export const AVATAR_SIDE = 512;
export const AVATAR_TYPES = ["image/jpeg", "image/png", "image/webp"];

export const ADULT_AGE = 18;

/** Años cumplidos a partir de "YYYY-MM-DD" (null sin fecha válida). */
export function ageFrom(birthDate: string | null | undefined, today = new Date()): number | null {
  if (!birthDate) return null;
  const [y, m, d] = birthDate.split("-").map(Number);
  if (!y || !m || !d) return null;
  let age = today.getFullYear() - y;
  if (today.getMonth() + 1 < m || (today.getMonth() + 1 === m && today.getDate() < d)) age -= 1;
  return age;
}

/** Solo dígitos (y + inicial); "" si queda vacío. */
export const normalizePhone = (raw: string) => raw.trim().replace(/[\s\-()]/g, "");
export const isValidPhone = (phone: string) => /^\+?[0-9]{10,15}$/.test(phone);

export const ESTADOS = [
  "Aguascalientes",
  "Baja California",
  "Baja California Sur",
  "Campeche",
  "Chiapas",
  "Chihuahua",
  "Ciudad de México",
  "Coahuila",
  "Colima",
  "Durango",
  "Estado de México",
  "Guanajuato",
  "Guerrero",
  "Hidalgo",
  "Jalisco",
  "Michoacán",
  "Morelos",
  "Nayarit",
  "Nuevo León",
  "Oaxaca",
  "Puebla",
  "Querétaro",
  "Quintana Roo",
  "San Luis Potosí",
  "Sinaloa",
  "Sonora",
  "Tabasco",
  "Tamaulipas",
  "Tlaxcala",
  "Veracruz",
  "Yucatán",
  "Zacatecas",
  "Fuera de México",
];

/** Mismos valores que el CHECK de student_profiles.grado. */
export const GRADOS: { id: string; label: string }[] = [
  { id: "secundaria_3", label: "3.º de secundaria" },
  { id: "bachillerato_1", label: "1.er semestre de bachillerato" },
  { id: "bachillerato_2", label: "2.º semestre de bachillerato" },
  { id: "bachillerato_3", label: "3.er semestre de bachillerato" },
  { id: "bachillerato_4", label: "4.º semestre de bachillerato" },
  { id: "bachillerato_5", label: "5.º semestre de bachillerato" },
  { id: "bachillerato_6", label: "6.º semestre de bachillerato" },
  { id: "egresado", label: "Ya terminé el bachillerato" },
  { id: "universidad", label: "Estudio la universidad" },
  { id: "otro", label: "Otro" },
];

export const USER_TYPE_LABELS: Record<string, string> = {
  student: "Estudiante",
  parent: "Padre / Tutor",
  teacher: "Maestro",
  director: "Escuela",
  admin: "Administrador",
};
