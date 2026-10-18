/**
 * Deshabilitar o rehabilitar una cuenta (solo admin). Deshabilitar bloquea el inicio de sesión en Supabase Auth
 * (ban) sin borrar nada: sus recibos, licencias y exámenes se conservan. Pensado para las cuentas de prueba.
 *   GET  ?id=…                 → { disabled, until }
 *   POST { id, disabled }      → { disabled, until }
 * La sesión que ya estaba abierta caduca al renovarse su token (máximo 1 hora).
 */

import { supabaseAdmin, userFromRequest } from "@/features/pagos/server/clients";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FOREVER = "876000h"; // 100 años

const json = (body: unknown, status = 200) => Response.json(body, { status });

async function requireAdmin(req: Request) {
  const caller = await userFromRequest(req);
  if (!caller) return null;
  const { data } = await supabaseAdmin().from("profiles").select("user_type").eq("id", caller.id).maybeSingle();
  return data?.user_type === "admin" ? caller : null;
}

async function state(id: string) {
  const { data, error } = await supabaseAdmin().auth.admin.getUserById(id);
  if (error || !data.user) throw new Error("Ese usuario ya no existe.");
  const until = (data.user as { banned_until?: string | null }).banned_until ?? null;
  return { disabled: !!until && new Date(until) > new Date(), until };
}

export async function GET(req: Request) {
  try {
    if (!(await requireAdmin(req))) return json({ error: "Solo un administrador puede ver esto." }, 403);
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return json({ error: "Falta el usuario." }, 400);
    return json(await state(id));
  } catch (err) {
    return json({ error: (err as Error).message || "No pudimos leer la cuenta." }, 500);
  }
}

export async function POST(req: Request) {
  try {
    const admin = await requireAdmin(req);
    if (!admin) return json({ error: "Solo un administrador puede hacer esto." }, 403);
    const { id, disabled } = (await req.json().catch(() => ({}))) as { id?: string; disabled?: boolean };
    if (!id || typeof disabled !== "boolean") return json({ error: "Datos incompletos." }, 400);
    if (id === admin.id) return json({ error: "No puedes deshabilitar tu propia cuenta." }, 400);

    const { error } = await supabaseAdmin().auth.admin.updateUserById(id, { ban_duration: disabled ? FOREVER : "none" });
    if (error) throw error;
    return json(await state(id));
  } catch (err) {
    console.error("[admin/cuenta]", err);
    return json({ error: "No pudimos cambiar el acceso de la cuenta." }, 500);
  }
}
