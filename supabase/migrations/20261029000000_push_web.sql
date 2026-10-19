-- Notificaciones push de la WebApp (fase 2). El celular guarda su suscripción con registrar_dispositivo_push(…, 'web')
-- y notificar() ya deja una entrega push "pendiente". Esto agrega el despachador:
-- · /api/notificaciones/push (Vercel, web-push + claves VAPID) toma las entregas con tomar_push_pendientes(),
--   las manda y las cierra con cerrar_push(). Las suscripciones que el navegador da por muertas (404/410) se
--   deshabilitan con deshabilitar_tokens_push().
-- · Horario de silencio: lo pendiente dentro del silencio de cada quien (prefs.silencio + prefs.zona) espera a que
--   termine. El aviso de prueba (T1) sale siempre: lo pidió la persona en ese momento.
-- · Caducan: lo que no salió en 3 días se omite ('caducado'); sin dispositivo activo se omite ('sin_dispositivo').
--   Las entregas de quien solo tiene la app nativa (ios/android) esperan a su propio despachador.
-- · Despertador: cada entrega nueva llama a la ruta al instante (pg_net, después del commit) y pg_cron la llama cada
--   5 minutos para lo que salió del silencio y los reintentos. La dirección y el secreto viven en el Vault; esta
--   migración los crea si no existen.

begin;

create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;

-- ═════════════════════════ 1. Vault: dirección y secreto del despachador ═════════════════════════

do $$
begin
  if not exists (select 1 from vault.secrets where name = 'push_url') then
    perform vault.create_secret('https://www.entrenamente.io/api/notificaciones/push', 'push_url');
  end if;
  if not exists (select 1 from vault.secrets where name = 'push_secret') then
    perform vault.create_secret(replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''), 'push_secret');
  end if;
end;
$$;

-- La ruta lo valida contra el Vault: así no hace falta copiar el secreto a Vercel.
create or replace function public.push_secreto_valido(p_secret text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce(length(p_secret) >= 32 and p_secret = (
    select decrypted_secret from vault.decrypted_secrets where name = 'push_secret'
  ), false)
$$;

-- ═════════════════════════ 2. Horario de silencio ═════════════════════════

-- true si ahora es silencio para esas preferencias. Cruza la medianoche (22:00 → 07:00) o no (13:00 → 15:00).
create or replace function public.en_silencio(p_prefs jsonb)
returns boolean
language plpgsql stable set search_path = ''
as $$
declare
  v_desde time;
  v_hasta time;
  v_ahora time;
begin
  v_desde := (p_prefs -> 'silencio' ->> 'desde')::time;
  v_hasta := (p_prefs -> 'silencio' ->> 'hasta')::time;
  if v_desde is null or v_hasta is null or v_desde = v_hasta then return false; end if;
  v_ahora := (now() at time zone coalesce(p_prefs ->> 'zona', 'America/Mexico_City'))::time;
  if v_desde < v_hasta then return v_ahora >= v_desde and v_ahora < v_hasta; end if;
  return v_ahora >= v_desde or v_ahora < v_hasta;
exception when others then
  return false;                                  -- preferencias raras: no se detiene el aviso
end;
$$;

-- ═════════════════════════ 3. Despachador (service role) ═════════════════════════

-- Toma hasta p_limite entregas push listas para la web. Una entrega tomada no se vuelve a tomar en 10 minutos.
-- tokens = [{ id, token }] con las suscripciones web activas del usuario.
create or replace function public.tomar_push_pendientes(p_limite integer default 100)
returns table (delivery_id uuid, title text, body text, action_url text, tokens jsonb)
language plpgsql volatile security definer set search_path = ''
as $$
#variable_conflict use_column
begin
  update public.notification_deliveries d
  set status = 'skipped', skip_reason = 'caducado', claimed_at = null
  where d.channel = 'push' and d.status = 'pending' and d.created_at < now() - interval '3 days';

  update public.notification_deliveries d
  set status = 'skipped', skip_reason = 'sin_dispositivo', claimed_at = null
  from public.notifications n
  where n.id = d.notification_id and d.channel = 'push' and d.status = 'pending'
    and not exists (select 1 from public.push_tokens t where t.user_id = n.user_id and t.disabled_at is null);

  return query
  with tomados as (
    update public.notification_deliveries d
    set claimed_at = now(), attempts = d.attempts + 1
    where d.id in (
      select x.id
      from public.notification_deliveries x
      join public.notifications n on n.id = x.notification_id
      join public.profiles p on p.id = n.user_id
      where x.channel = 'push' and x.status = 'pending'
        and (x.claimed_at is null or x.claimed_at < now() - interval '10 minutes')
        and exists (
          select 1 from public.push_tokens t where t.user_id = n.user_id and t.platform = 'web' and t.disabled_at is null
        )
        and (n.event_code = 'T1' or not public.en_silencio(coalesce(p.notification_prefs, public.notification_prefs_default())))
      order by x.created_at
      limit least(greatest(p_limite, 1), 500)
      for update of x skip locked
    )
    returning d.id, d.notification_id
  )
  select t.id, n.title::text, n.body, n.action_url,
    (select jsonb_agg(jsonb_build_object('id', k.id, 'token', k.token))
     from public.push_tokens k where k.user_id = n.user_id and k.platform = 'web' and k.disabled_at is null)
  from tomados t
  join public.notifications n on n.id = t.notification_id;
end;
$$;

-- Resultado del envío. Tres intentos fallidos = failed; antes vuelve a la cola.
create or replace function public.cerrar_push(p_id uuid, p_ok boolean, p_error text default null)
returns void
language sql volatile security definer set search_path = ''
as $$
  update public.notification_deliveries set
    status = case when p_ok then 'sent' when attempts >= 3 then 'failed' else 'pending' end::public.delivery_status,
    error = case when p_ok then null else left(p_error, 500) end,
    sent_at = case when p_ok then now() else sent_at end,
    claimed_at = case when p_ok then claimed_at end
  where id = p_id and channel = 'push'
$$;

-- El servicio push respondió 404/410: la suscripción ya no existe (desinstaló la app o quitó el permiso).
create or replace function public.deshabilitar_tokens_push(p_ids uuid[])
returns void
language sql volatile security definer set search_path = ''
as $$
  update public.push_tokens set disabled_at = now() where id = any (p_ids) and disabled_at is null
$$;

-- ═════════════════════════ 4. Despertador ═════════════════════════

-- Llama a la ruta si hay algo que mandar. Nunca rompe la transacción: sin Vault o sin pg_net, sale con el cron.
create or replace function public.despertar_push()
returns void
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_url text;
  v_secret text;
begin
  if not exists (
    select 1 from public.notification_deliveries d
    join public.notifications n on n.id = d.notification_id
    where d.channel = 'push' and d.status = 'pending'
      and exists (select 1 from public.push_tokens t where t.user_id = n.user_id and t.platform = 'web' and t.disabled_at is null)
  ) then
    return;
  end if;
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'push_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'push_secret';
  if v_url is null or v_secret is null then return; end if;
  perform net.http_post(
    url := v_url,
    headers := jsonb_build_object('authorization', 'Bearer ' || v_secret, 'content-type', 'application/json'),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
exception when others then
  return;
end;
$$;

-- Una llamada por transacción basta: pg_net la manda después del commit y el despachador toma todo lo pendiente
-- (procesar_vencimientos() puede crear cientos de avisos de un jalón).
create or replace function public.notif_despertar_push()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if current_setting('entrenamente.push_despertado', true) is distinct from 'si' then
    perform set_config('entrenamente.push_despertado', 'si', true);
    perform public.despertar_push();
  end if;
  return null;
end;
$$;

drop trigger if exists notification_deliveries_push on public.notification_deliveries;
create trigger notification_deliveries_push
  after insert on public.notification_deliveries
  for each row when (new.channel = 'push' and new.status = 'pending')
  execute function public.notif_despertar_push();

-- Lo que salió del silencio y los reintentos. Volver a correr la migración no duplica el job.
select cron.schedule('notificaciones-push', '*/5 * * * *', 'select public.despertar_push()');

-- ═════════════════════════ 5. Permisos ═════════════════════════

revoke execute on function public.push_secreto_valido(text) from public, anon, authenticated;
revoke execute on function public.en_silencio(jsonb) from public, anon, authenticated;
revoke execute on function public.tomar_push_pendientes(integer) from public, anon, authenticated;
revoke execute on function public.cerrar_push(uuid, boolean, text) from public, anon, authenticated;
revoke execute on function public.deshabilitar_tokens_push(uuid[]) from public, anon, authenticated;
revoke execute on function public.despertar_push() from public, anon, authenticated;
revoke execute on function public.notif_despertar_push() from public, anon, authenticated;
grant execute on function public.push_secreto_valido(text) to service_role;
grant execute on function public.tomar_push_pendientes(integer) to service_role;
grant execute on function public.cerrar_push(uuid, boolean, text) to service_role;
grant execute on function public.deshabilitar_tokens_push(uuid[]) to service_role;

commit;

-- Verificación: deben salir los dos secretos del Vault y el trabajo de pg_cron.
select
  (select string_agg(name, ', ' order by name) from vault.secrets where name like 'push_%') as secretos,
  (select string_agg(jobname, ', ' order by jobname) from cron.job where jobname = 'notificaciones-push') as trabajo_cron,
  (select count(*) from public.push_tokens where platform = 'web' and disabled_at is null) as suscripciones_web;
