-- Centro de notificaciones sin correo: los avisos viven dentro de Entrena Mente (campana + aviso flotante en
-- tiempo real) y el camino queda listo para las notificaciones push de las apps (Capacitor + FCM/APNs).
-- · Catálogo: todos los eventos salen por In-App y, cuando haya apps, por push. Nada por correo.
-- · Correos pendientes de la versión anterior: se marcan como omitidos.
-- · push_tokens + registrar_dispositivo_push() / quitar_dispositivo_push(): la app guarda el token del celular.
-- · notificar(): crea la entrega push "pendiente" solo si el usuario tiene un dispositivo registrado y no apagó
--   el canal o la categoría. El horario de silencio lo respetará el despachador de push (fase 2).
-- · Realtime: la campana recibe cada aviso nuevo al instante (respeta RLS: cada quien solo ve los suyos).
-- · pg_cron: procesar_vencimientos() todos los días a las 8:00 (CDMX); ya no hace falta el cron de Vercel.
-- · Se quitan las funciones del despachador de correo.

begin;

create extension if not exists pg_cron;

-- ═════════════════════════ 1. Catálogo sin correo ═════════════════════════

update public.notification_events set canales = '{in_app,push}';

update public.notification_deliveries
set status = 'skipped', skip_reason = 'correo_desactivado', claimed_at = null
where channel = 'email' and status = 'pending';

drop function if exists public.tomar_correos_pendientes(integer);
drop function if exists public.cerrar_entrega(uuid, boolean, text, text);
drop function if exists public.despertar_despachador();

-- ═════════════════════════ 2. Dispositivos para push ═════════════════════════

create table public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  token text not null unique check (length(token) between 20 and 4096),
  platform text not null check (platform in ('ios', 'android', 'web')),
  device_name text check (device_name is null or length(device_name) <= 100),
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  disabled_at timestamptz                 -- el proveedor dijo que el token ya no sirve
);
create index push_tokens_user_idx on public.push_tokens (user_id) where disabled_at is null;

alter table public.push_tokens enable row level security;
revoke all on public.push_tokens from public, anon, authenticated;

-- La app lo llama al obtener el token del celular (y en cada arranque: actualiza last_seen_at).
-- Si el token estaba en otra cuenta (otro usuario inició sesión en ese celular), pasa a la actual.
create or replace function public.registrar_dispositivo_push(p_token text, p_platform text, p_device_name text default null)
returns void
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_uid uuid := public.exigir_sesion();
begin
  if p_platform not in ('ios', 'android', 'web') then
    raise exception 'Plataforma no válida.' using errcode = '22023';
  end if;
  insert into public.push_tokens (user_id, token, platform, device_name)
  values (v_uid, p_token, p_platform, left(nullif(trim(p_device_name), ''), 100))
  on conflict (token) do update set
    user_id = excluded.user_id,
    platform = excluded.platform,
    device_name = coalesce(excluded.device_name, public.push_tokens.device_name),
    last_seen_at = now(),
    disabled_at = null;
end;
$$;

-- Al cerrar sesión en el celular.
create or replace function public.quitar_dispositivo_push(p_token text)
returns void
language sql volatile security definer set search_path = ''
as $$
  delete from public.push_tokens where token = p_token and user_id = public.exigir_sesion()
$$;

-- ═════════════════════════ 3. notificar() sin correo, con push ═════════════════════════

create or replace function public.notificar(
  p_user_id uuid,
  p_event_code varchar,
  p_title text,
  p_body text,
  p_action_url text default null,
  p_dedupe_key text default null
)
returns uuid
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_evento public.notification_events;
  v_prefs jsonb;
  v_edad integer;
  v_id uuid;
  v_categoria_on boolean;
  v_skip text;
begin
  select * into v_evento from public.notification_events where code = p_event_code;
  if not found then raise exception 'Evento de notificación desconocido: %', p_event_code using errcode = '22023'; end if;

  select coalesce(p.notification_prefs, public.notification_prefs_default()), public.edad(p.birth_date)
  into v_prefs, v_edad
  from public.profiles p where p.id = p_user_id;
  if not found then return null; end if;          -- cuenta borrada en la misma operación

  v_categoria_on := v_evento.critico or coalesce((v_prefs -> 'categorias' ->> v_evento.categoria)::boolean, true);

  -- Mercadotecnia: solo con permiso y nunca a menores (a ellos les llega por su tutor).
  if v_evento.categoria = 'marketing' and (not v_categoria_on or coalesce(v_edad, 0) < 18) then
    return null;
  end if;

  insert into public.notifications (user_id, event_code, title, body, action_url, dedupe_key)
  values (p_user_id, p_event_code, left(p_title, 150), p_body, p_action_url, left(p_dedupe_key, 100))
  on conflict (user_id, dedupe_key) do nothing
  returning id into v_id;
  if v_id is null then return null; end if;

  -- Push: solo si hay un celular registrado. Los críticos ignoran el interruptor del canal.
  if 'push' = any (v_evento.canales)
     and exists (select 1 from public.push_tokens where user_id = p_user_id and disabled_at is null) then
    v_skip := case
      when not v_categoria_on then 'opt_out'
      when not v_evento.critico and not coalesce((v_prefs -> 'canales' ->> 'push')::boolean, true) then 'opt_out'
    end;
    insert into public.notification_deliveries (notification_id, channel, status, skip_reason)
    values (v_id, 'push', case when v_skip is null then 'pending' else 'skipped' end::public.delivery_status, v_skip);
  end if;

  return v_id;
end;
$$;

-- ═════════════════════════ 4. Tiempo real y cron ═════════════════════════

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications'
     ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end;
$$;

-- 14:00 UTC = 8:00 en el centro de México. Volver a correr la migración no duplica el job.
select cron.schedule('notificaciones-vencimientos', '0 14 * * *', 'select public.procesar_vencimientos()');

-- ═════════════════════════ 5. Permisos ═════════════════════════

revoke execute on function public.registrar_dispositivo_push(text, text, text) from public, anon;
revoke execute on function public.quitar_dispositivo_push(text) from public, anon;
revoke execute on function public.notificar(uuid, varchar, text, text, text, text) from public, anon, authenticated;
grant execute on function public.registrar_dispositivo_push(text, text, text) to authenticated;
grant execute on function public.quitar_dispositivo_push(text) to authenticated;
grant execute on function public.notificar(uuid, varchar, text, text, text, text) to service_role;
grant select on public.push_tokens to service_role;

commit;
