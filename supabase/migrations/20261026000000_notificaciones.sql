-- Centro de notificaciones, fase 1: bandeja In-App (campana), correo transaccional y preferencias v2.
-- Mapeo completo de eventos en docs/notificaciones-mapeo-eventos.md.
-- · notification_events: catálogo (código, categoría, si es crítico y por qué canales sale).
-- · notifications: la bandeja de la campana; `dedupe_key` evita repetir el mismo aviso al mismo usuario.
-- · notification_deliveries: un renglón por canal externo (correo hoy; push y WhatsApp en la fase 2).
-- · notificar(): único punto de entrada; aplica preferencias, edad y deduplicación.
-- · Disparadores: bienvenida, pago recibido, licencia del admin, lugar asignado por el tutor, vinculación,
--   desvinculación y solicitud de plan. Vencimientos (5 días, 1 día y paso a Demo) con procesar_vencimientos().
-- · Correo: /api/notificaciones/despachar toma las entregas pendientes y las manda por Resend. Lo despierta
--   pg_net en cada aviso nuevo (si se configuran los secretos del Vault, ver abajo) y el cron diario de Vercel.
-- · notification_prefs pasa a v2 (canales + categorías + silencio + zona); `novedades` se vuelve `marketing`.
--
-- Después de correrla (opcional, para que el correo salga al instante y no solo con el cron diario):
--   select vault.create_secret('https://www.entrenamente.io/api/notificaciones/despachar', 'notificaciones_url');
--   select vault.create_secret('<el mismo valor que CRON_SECRET en Vercel>', 'notificaciones_secret');

begin;

create extension if not exists pg_net with schema extensions;

-- ═════════════════════════ 1. Catálogo de eventos ═════════════════════════

create type public.notification_channel as enum ('in_app', 'email', 'push', 'whatsapp');
create type public.delivery_status as enum ('pending', 'sent', 'failed', 'skipped');

create table public.notification_events (
  code varchar(10) primary key,
  -- cuenta/pagos/familia: no se pueden apagar. El resto se apaga desde las preferencias.
  categoria text not null check (categoria in (
    'cuenta', 'pagos', 'familia', 'plan', 'racha', 'resultados', 'tutor_resumen', 'contenido', 'marketing'
  )),
  critico boolean not null,
  canales public.notification_channel[] not null,
  descripcion text not null
);
alter table public.notification_events enable row level security;
revoke all on public.notification_events from public, anon, authenticated;

insert into public.notification_events (code, categoria, critico, canales, descripcion) values
  ('A1',  'cuenta',  true, '{in_app}',        'Bienvenida al crear la cuenta'),
  ('P1',  'pagos',   true, '{in_app,email}',  'Pago recibido (Stripe)'),
  ('P4',  'pagos',   true, '{in_app,email}',  'Pago OXXO/SPEI no completado'),
  ('P5',  'pagos',   true, '{in_app,email}',  'Tarjeta rechazada al renovar'),
  ('P7',  'pagos',   true, '{in_app,email}',  'Plan por vencer (5 días / 1 día) sin renovación automática'),
  ('P8',  'pagos',   true, '{in_app,email}',  'Próximo cargo automático'),
  ('P9',  'pagos',   true, '{in_app,email}',  'Plan terminado: el estudiante pasa a Demo'),
  ('P10', 'pagos',   true, '{in_app}',        'El tutor te asignó un lugar Pro'),
  ('P11', 'pagos',   true, '{in_app,email}',  'El equipo te activó un plan'),
  ('F1',  'familia', true, '{in_app,email}',  'Un estudiante se vinculó con el tutor'),
  -- El correo de F3 ya lo manda /api/tutor/solicitud.
  ('F3',  'familia', true, '{in_app}',        'El estudiante pide activar o renovar su plan'),
  ('F5',  'familia', true, '{in_app,email}',  'El tutor desvinculó al estudiante'),
  ('F6',  'familia', true, '{in_app,email}',  'El estudiante se desvinculó del tutor');

-- ═════════════════════════ 2. Bandeja y entregas ═════════════════════════

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  event_code varchar(10) not null references public.notification_events(code),
  title varchar(150) not null,
  body text not null,
  action_url text check (action_url is null or action_url ~ '^/'),     -- solo rutas internas
  read_at timestamptz,
  dedupe_key varchar(100),
  created_at timestamptz not null default now(),
  unique (user_id, dedupe_key)
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);
create index idx_notifications_user_unread on public.notifications (user_id) where read_at is null;

create table public.notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null references public.notifications(id) on delete cascade,
  channel public.notification_channel not null,
  status public.delivery_status not null default 'pending',
  provider_id text,                     -- id de Resend / FCM / WhatsApp
  skip_reason text,                     -- opt_out, sin_correo, underage_marketing…
  error text,
  attempts integer not null default 0,
  claimed_at timestamptz,               -- lo tomó un despachador (evita mandar dos veces)
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  unique (notification_id, channel)
);
create index notification_deliveries_pending_idx on public.notification_deliveries (channel, created_at) where status = 'pending';

-- El usuario solo lee su bandeja; marcar como leída va por función. Las entregas son internas.
alter table public.notifications enable row level security;
alter table public.notification_deliveries enable row level security;
revoke all on public.notifications, public.notification_deliveries from public, anon, authenticated;
grant select on public.notifications to authenticated;
create policy "notifications: ver las propias" on public.notifications
  for select to authenticated using ((select auth.uid()) = user_id);

-- ═════════════════════════ 3. Preferencias v2 ═════════════════════════

create or replace function public.notification_prefs_default()
returns jsonb
language sql immutable set search_path = ''
as $$
  select jsonb_build_object(
    'v', 2,
    'canales', jsonb_build_object('push', true, 'email', true, 'whatsapp', false),
    'categorias', jsonb_build_object(
      'plan', true, 'racha', true, 'resultados', true, 'tutor_resumen', true, 'contenido', true, 'marketing', false
    ),
    'hora', '18:00',
    'silencio', jsonb_build_object('desde', '22:00', 'hasta', '07:00'),
    'zona', 'America/Mexico_City'
  )
$$;

alter table public.profiles alter column notification_prefs set default public.notification_prefs_default();

-- Conserva lo que cada quien ya eligió; `novedades` pasa a `marketing`.
update public.profiles p
set notification_prefs = jsonb_set(
  jsonb_set(public.notification_prefs_default(), '{categorias}',
    (public.notification_prefs_default() -> 'categorias') || jsonb_strip_nulls(jsonb_build_object(
      'plan', p.notification_prefs -> 'plan',
      'racha', p.notification_prefs -> 'racha',
      'resultados', p.notification_prefs -> 'resultados',
      'tutor_resumen', p.notification_prefs -> 'tutor_resumen',
      'marketing', p.notification_prefs -> 'novedades'
    ))),
  '{hora}', coalesce(p.notification_prefs -> 'hora', '"18:00"'))
where coalesce(p.notification_prefs ->> 'v', '1') <> '2';

-- Cambios parciales: { canales: {email: false}, categorias: {racha: false}, hora, silencio: {desde, hasta}, zona }.
-- Solo llaves conocidas; horas en HH:MM; zona horaria válida.
create or replace function public.guardar_mis_notificaciones(p_prefs jsonb)
returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_uid uuid := public.exigir_sesion();
  v_nuevo jsonb;
  k text;
  v_hora constant text := '^([01][0-9]|2[0-3]):[0-5][0-9]$';
begin
  select notification_prefs into v_nuevo from public.profiles where id = v_uid;
  if coalesce(v_nuevo ->> 'v', '1') <> '2' then v_nuevo := public.notification_prefs_default(); end if;

  foreach k in array array['push', 'email', 'whatsapp'] loop
    if jsonb_typeof(p_prefs -> 'canales' -> k) = 'boolean' then
      v_nuevo := jsonb_set(v_nuevo, array['canales', k], p_prefs -> 'canales' -> k);
    end if;
  end loop;
  foreach k in array array['plan', 'racha', 'resultados', 'tutor_resumen', 'contenido', 'marketing'] loop
    if jsonb_typeof(p_prefs -> 'categorias' -> k) = 'boolean' then
      v_nuevo := jsonb_set(v_nuevo, array['categorias', k], p_prefs -> 'categorias' -> k);
    end if;
  end loop;
  if (p_prefs ->> 'hora') ~ v_hora then
    v_nuevo := jsonb_set(v_nuevo, '{hora}', to_jsonb(p_prefs ->> 'hora'));
  end if;
  foreach k in array array['desde', 'hasta'] loop
    if (p_prefs -> 'silencio' ->> k) ~ v_hora then
      v_nuevo := jsonb_set(v_nuevo, array['silencio', k], to_jsonb(p_prefs -> 'silencio' ->> k));
    end if;
  end loop;
  if exists (select 1 from pg_catalog.pg_timezone_names where name = p_prefs ->> 'zona') then
    v_nuevo := jsonb_set(v_nuevo, '{zona}', to_jsonb(p_prefs ->> 'zona'));
  end if;

  update public.profiles set notification_prefs = v_nuevo, updated_at = now() where id = v_uid;
  return v_nuevo;
end;
$$;

-- ═════════════════════════ 4. notificar() ═════════════════════════

-- Despierta al despachador de correo (pg_net) si los secretos del Vault existen. Nunca rompe la transacción:
-- sin Vault, sin pg_net o con error, el correo sale con el cron diario.
create or replace function public.despertar_despachador()
returns void
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_url text;
  v_secret text;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'notificaciones_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'notificaciones_secret';
  if v_url is null or v_secret is null then return; end if;
  perform net.http_post(
    url := v_url,
    headers := jsonb_build_object('authorization', 'Bearer ' || v_secret, 'content-type', 'application/json'),
    body := '{}'::jsonb
  );
exception when others then
  return;
end;
$$;

-- Devuelve el id del aviso, o null si ya existía (misma dedupe_key) o si no aplica (marketing sin permiso).
-- In-App siempre que se inserte; el correo según el evento, su criticidad y las preferencias.
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
  v_email text;
  v_edad integer;
  v_id uuid;
  v_categoria_on boolean;
  v_skip text;
begin
  select * into v_evento from public.notification_events where code = p_event_code;
  if not found then raise exception 'Evento de notificación desconocido: %', p_event_code using errcode = '22023'; end if;

  select coalesce(p.notification_prefs, public.notification_prefs_default()), p.email, public.edad(p.birth_date)
  into v_prefs, v_email, v_edad
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

  if 'email' = any (v_evento.canales) then
    v_skip := case
      when coalesce(v_email, '') = '' then 'sin_correo'
      when not v_categoria_on then 'opt_out'
      when not v_evento.critico and not coalesce((v_prefs -> 'canales' ->> 'email')::boolean, true) then 'opt_out'
    end;
    insert into public.notification_deliveries (notification_id, channel, status, skip_reason)
    values (v_id, 'email', case when v_skip is null then 'pending' else 'skipped' end::public.delivery_status, v_skip);
    if v_skip is null then perform public.despertar_despachador(); end if;
  end if;

  return v_id;
end;
$$;

-- ═════════════════════════ 5. Bandeja del usuario ═════════════════════════

-- null = todas.
create or replace function public.marcar_notificaciones_leidas(p_ids uuid[] default null)
returns integer
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_uid uuid := public.exigir_sesion();
  v_n integer;
begin
  update public.notifications set read_at = now()
  where user_id = v_uid and read_at is null and (p_ids is null or id = any (p_ids));
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

-- ═════════════════════════ 6. Despachador de correo (service role) ═════════════════════════

-- Toma hasta p_limite correos pendientes. Un correo tomado no se vuelve a tomar en 10 minutos.
create or replace function public.tomar_correos_pendientes(p_limite integer default 50)
returns table (delivery_id uuid, email text, nombre text, event_code varchar, title text, body text, action_url text)
language sql volatile security definer set search_path = ''
as $$
  with tomados as (
    update public.notification_deliveries d
    set claimed_at = now(), attempts = d.attempts + 1
    where d.id in (
      select id from public.notification_deliveries
      where channel = 'email' and status = 'pending' and (claimed_at is null or claimed_at < now() - interval '10 minutes')
      order by created_at
      limit least(greatest(p_limite, 1), 200)
      for update skip locked
    )
    returning d.id, d.notification_id
  )
  select t.id, p.email, coalesce(nullif(trim(p.alias), ''), split_part(p.full_name, ' ', 1)), n.event_code, n.title, n.body, n.action_url
  from tomados t
  join public.notifications n on n.id = t.notification_id
  join public.profiles p on p.id = n.user_id
$$;

-- Resultado del envío. Tres intentos fallidos = failed.
create or replace function public.cerrar_entrega(p_id uuid, p_ok boolean, p_provider_id text default null, p_error text default null)
returns void
language sql volatile security definer set search_path = ''
as $$
  update public.notification_deliveries set
    status = case when p_ok then 'sent' when attempts >= 3 then 'failed' else 'pending' end::public.delivery_status,
    provider_id = coalesce(p_provider_id, provider_id),
    error = case when p_ok then null else left(p_error, 500) end,
    sent_at = case when p_ok then now() else sent_at end,
    claimed_at = case when p_ok then claimed_at end
  where id = p_id
$$;

-- ═════════════════════════ 7. Vencimientos (cron diario) ═════════════════════════

-- Registro explícito del paso a Demo: una fila por licencia y fecha de vencimiento.
create table public.license_expirations (
  license_id uuid not null references public.licenses(id) on delete cascade,
  expires_at timestamptz not null,
  recorded_at timestamptz not null default now(),
  primary key (license_id, expires_at)
);
alter table public.license_expirations enable row level security;
revoke all on public.license_expirations from public, anon, authenticated;

-- Lo ya vencido no se avisa al estrenar el centro de notificaciones.
insert into public.license_expirations (license_id, expires_at, recorded_at)
select id, expires_at, expires_at from public.licenses where expires_at <= now()
on conflict do nothing;

create or replace function public.alias_de(p_user uuid)
returns text
language sql stable security definer set search_path = ''
as $$
  select coalesce(nullif(trim(alias), ''), nullif(split_part(full_name, ' ', 1), ''), 'Tu estudiante')
  from public.profiles where id = p_user
$$;

-- P7: avisa 5 días y 1 día antes a quien paga, si no se renueva solo.
-- P9: registra cada licencia vencida y avisa al estudiante (si ya no tiene otro lugar vigente) y a quien paga.
create or replace function public.procesar_vencimientos()
returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  r record;
  s record;
  v_dias integer;
  v_aviso integer := 0;
  v_vencidas integer := 0;
  v_url text;
begin
  for r in
    select l.id, l.owner_id, l.expires_at, p.user_type
    from public.licenses l join public.profiles p on p.id = l.owner_id
    where l.status = 'active' and l.expires_at > now() and l.expires_at <= now() + interval '5 days'
      and not public.renovacion_automatica(l.id)
  loop
    v_dias := case when r.expires_at <= now() + interval '1 day' then 1 when r.expires_at > now() + interval '4 days' then 5 end;
    continue when v_dias is null;
    v_url := case when r.user_type = 'student' then '/pricing' else '/app/dashboard/billing' end;
    if public.notificar(
      r.owner_id, 'P7',
      case v_dias when 1 then 'Tu plan termina mañana' else 'Tu plan termina en 5 días' end,
      'Renuévalo para no perder el acceso Pro. Vence el ' ||
        to_char(r.expires_at at time zone 'America/Mexico_City', 'DD/MM/YYYY') || '.',
      v_url,
      'P7:' || r.id || ':' || v_dias || ':' || to_char(r.expires_at, 'YYYYMMDD')
    ) is not null then v_aviso := v_aviso + 1; end if;
  end loop;

  for r in
    insert into public.license_expirations (license_id, expires_at)
    select l.id, l.expires_at from public.licenses l
    where l.expires_at <= now() and l.expires_at > now() - interval '3 days'
    on conflict do nothing
    returning license_id, expires_at
  loop
    v_vencidas := v_vencidas + 1;
    for s in
      select ls.student_id, l.owner_id
      from public.license_seats ls join public.licenses l on l.id = ls.license_id
      where ls.license_id = r.license_id and ls.released_at is null
        and not exists (
          select 1 from public.license_seats o join public.licenses ol on ol.id = o.license_id
          where o.student_id = ls.student_id and o.released_at is null and o.license_id <> ls.license_id
            and ol.status = 'active' and ol.expires_at > now()
        )
    loop
      perform public.notificar(
        s.student_id, 'P9', 'Tu plan Pro terminó',
        case when s.owner_id = s.student_id
          then 'Sigues en modo Demo. Renueva tu plan para volver a tus exámenes completos.'
          else 'Sigues en modo Demo. Pídele a tu tutor que renueve tu plan.' end,
        case when s.owner_id = s.student_id then '/pricing' else '/app/student' end,
        'P9:' || r.license_id || ':' || to_char(r.expires_at, 'YYYYMMDD')
      );
      if s.owner_id <> s.student_id then
        perform public.notificar(
          s.owner_id, 'P9', 'Terminó el plan de ' || public.alias_de(s.student_id),
          public.alias_de(s.student_id) || ' pasó a modo Demo. Renueva para que siga entrenando.',
          '/app/dashboard/billing',
          'P9:' || r.license_id || ':' || s.student_id || ':' || to_char(r.expires_at, 'YYYYMMDD')
        );
      end if;
    end loop;
    -- Tutor sin estudiantes asignados: igual se le avisa.
    if not exists (select 1 from public.license_seats where license_id = r.license_id and released_at is null) then
      perform public.notificar(
        (select owner_id from public.licenses where id = r.license_id), 'P9', 'Tu plan terminó',
        'Renueva tu plan para seguir usando Entrena Mente sin límites.', '/app/dashboard/billing',
        'P9:' || r.license_id || ':' || to_char(r.expires_at, 'YYYYMMDD')
      );
    end if;
  end loop;

  return jsonb_build_object('por_vencer', v_aviso, 'vencidas', v_vencidas);
end;
$$;

-- ═════════════════════════ 8. Disparadores ═════════════════════════

-- A1 Bienvenida.
create or replace function public.notif_bienvenida()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  perform public.notificar(
    new.id, 'A1', '¡Bienvenido a Entrena Mente!',
    'Aquí te avisaremos de tus exámenes, tu plan y tus pagos. Abre tu guía de inicio para empezar.',
    null, 'A1'
  );
  return null;
end;
$$;
create trigger notif_bienvenida after insert on public.profiles
  for each row execute function public.notif_bienvenida();

-- P1 Pago recibido (solo Stripe; los recibos del admin avisan con P11).
create or replace function public.notif_pago_recibido()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.payment_provider = 'stripe' then
    perform public.notificar(
      new.user_id, 'P1', 'Recibimos tu pago',
      'Pago de $' || to_char(new.amount_paid, 'FM999,990.00') || ' ' || new.currency || '. Recibo ' || new.receipt_code ||
        '. Tu plan está activo hasta el ' ||
        to_char(new.license_expires_at at time zone 'America/Mexico_City', 'DD/MM/YYYY') || '.',
      case when (select user_type from public.profiles where id = new.user_id) = 'student'
        then '/app/student' else '/app/dashboard/billing' end,
      'P1:' || new.receipt_code
    );
  end if;
  return null;
end;
$$;
create trigger notif_pago_recibido after insert on public.receipts
  for each row execute function public.notif_pago_recibido();

-- P11 Licencia otorgada por el admin.
create or replace function public.notif_licencia_admin()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.source = 'admin' and new.expires_at > now() then
    perform public.notificar(
      new.owner_id, 'P11', 'Te activamos un plan',
      'El equipo de Entrena Mente activó tu acceso hasta el ' ||
        to_char(new.expires_at at time zone 'America/Mexico_City', 'DD/MM/YYYY') || '.',
      null, 'P11:' || new.id
    );
  end if;
  return null;
end;
$$;
create trigger notif_licencia_admin after insert on public.licenses
  for each row execute function public.notif_licencia_admin();

-- P10 El tutor asignó un lugar Pro a su estudiante.
create or replace function public.notif_lugar_asignado()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_owner uuid;
begin
  select owner_id into v_owner from public.licenses where id = new.license_id;
  if v_owner is not null and v_owner <> new.student_id then
    perform public.notificar(
      new.student_id, 'P10', '¡Ya eres Pro!',
      public.alias_de(v_owner) || ' activó tu plan. Ya tienes todos los exámenes, la racha y tu plan de estudio.',
      '/app/student', 'P10:' || new.id
    );
  end if;
  return null;
end;
$$;
create trigger notif_lugar_asignado after insert on public.license_seats
  for each row execute function public.notif_lugar_asignado();

-- F1 Vinculación (invitación aceptada o registro con liga).
create or replace function public.notif_vinculo()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  perform public.notificar(
    new.owner_id, 'F1', public.alias_de(new.student_id) || ' se unió a tu cuenta',
    'Ya puedes ver su avance y activarle su plan.',
    '/app/dashboard', 'F1:' || new.student_id || ':' || to_char(new.linked_at, 'YYYYMMDDHH24MISS')
  );
  return null;
end;
$$;
create trigger notif_vinculo after insert on public.tutor_students
  for each row execute function public.notif_vinculo();

-- F5 / F6 Desvinculación: avisa a la otra parte de quien la hizo. Sin sesión (admin o SQL) no avisa.
create or replace function public.notif_desvinculo()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid = old.owner_id then
    perform public.notificar(
      old.student_id, 'F5', 'Tu tutor te desvinculó',
      public.alias_de(old.owner_id) || ' ya no da seguimiento a tu cuenta. Si te patrocinaba el plan, ahora estás en modo Demo.',
      '/app/student', 'F5:' || old.owner_id || ':' || to_char(now(), 'YYYYMMDDHH24MISS')
    );
  elsif v_uid = old.student_id then
    perform public.notificar(
      old.owner_id, 'F6', public.alias_de(old.student_id) || ' se desvinculó',
      'Ya no verás su avance y su lugar del plan quedó libre para otro estudiante.',
      '/app/dashboard', 'F6:' || old.student_id || ':' || to_char(now(), 'YYYYMMDDHH24MISS')
    );
  end if;
  return null;
end;
$$;
create trigger notif_desvinculo after delete on public.tutor_students
  for each row execute function public.notif_desvinculo();

-- F3 El estudiante pide activar o renovar su plan (el correo lo manda /api/tutor/solicitud).
create or replace function public.notif_solicitud_plan()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  perform public.notificar(
    new.owner_id, 'F3', public.alias_de(new.student_id) || ' te pide activar su plan',
    'Quiere seguir entrenando con todos los exámenes. Revisa tu plan y asígnale un lugar.',
    '/app/dashboard/billing', 'F3:' || new.id
  );
  return null;
end;
$$;
create trigger notif_solicitud_plan after insert on public.tutor_requests
  for each row execute function public.notif_solicitud_plan();

-- ═════════════════════════ 9. Permisos ═════════════════════════

revoke execute on function public.notification_prefs_default() from public, anon;
revoke execute on function public.despertar_despachador() from public, anon, authenticated;
revoke execute on function public.notificar(uuid, varchar, text, text, text, text) from public, anon, authenticated;
revoke execute on function public.marcar_notificaciones_leidas(uuid[]) from public, anon;
revoke execute on function public.tomar_correos_pendientes(integer) from public, anon, authenticated;
revoke execute on function public.cerrar_entrega(uuid, boolean, text, text) from public, anon, authenticated;
revoke execute on function public.alias_de(uuid) from public, anon, authenticated;
revoke execute on function public.procesar_vencimientos() from public, anon, authenticated;
revoke execute on function public.notif_bienvenida() from public, anon, authenticated;
revoke execute on function public.notif_pago_recibido() from public, anon, authenticated;
revoke execute on function public.notif_licencia_admin() from public, anon, authenticated;
revoke execute on function public.notif_lugar_asignado() from public, anon, authenticated;
revoke execute on function public.notif_vinculo() from public, anon, authenticated;
revoke execute on function public.notif_desvinculo() from public, anon, authenticated;
revoke execute on function public.notif_solicitud_plan() from public, anon, authenticated;

grant execute on function public.notification_prefs_default() to authenticated;
grant execute on function public.marcar_notificaciones_leidas(uuid[]) to authenticated;
grant execute on function public.notificar(uuid, varchar, text, text, text, text) to service_role;
grant execute on function public.tomar_correos_pendientes(integer) to service_role;
grant execute on function public.cerrar_entrega(uuid, boolean, text, text) to service_role;
grant execute on function public.procesar_vencimientos() to service_role;
grant select on public.notifications, public.notification_deliveries, public.notification_events to service_role;

commit;
