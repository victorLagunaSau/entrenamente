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

/** Número local sin lada: 7 a 12 dígitos (México y EE. UU. usan 10, Guatemala 8). */
export const isValidLocalPhone = (digits: string) => /^[0-9]{7,12}$/.test(digits);

/** El teléfono se guarda con la lada del país (+52…). Para editarlo se muestra sin ella. */
export function localPhone(stored: string | null, lada: string | null) {
  if (!stored) return "";
  return lada && stored.startsWith(lada) ? stored.slice(lada.length) : stored;
}

/** Lo escrito → lo que se guarda: si ya trae "+", se respeta; si no, se le pone la lada del país. */
export function fullPhone(typed: string, lada: string | null) {
  const clean = normalizePhone(typed);
  if (!clean) return "";
  return clean.startsWith("+") || !lada ? clean : `${lada}${clean}`;
}

/** Estados de la República: la lista solo aplica cuando el país es México. */
export const PAIS_CON_ESTADOS = "MX";

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
];

export const USER_TYPE_LABELS: Record<string, string> = {
  student: "Estudiante",
  parent: "Padre / Tutor",
  teacher: "Maestro",
  director: "Escuela",
  admin: "Administrador",
};
