-- Entrena Mente · Perfil y Configuración de la cuenta (todos los tipos de usuario).
-- Pegar completo en Supabase → SQL Editor → Run (una sola vez). Va en una transacción.
--
--   · profiles: fecha de nacimiento, teléfono (solo mayores de 18), estado de la República,
--     preferencias de notificación. avatar_url ya existía: "preset:<id>" = avatar de ejemplo, o URL de Storage.
--   · student_profiles: grado escolar y promedio (escuela de procedencia y "no estudio" ya existían).
--   · Storage "avatars": público, 1 MB, jpg/png/webp, cada quien solo en su carpeta {uid}/.
--   · mi_cuenta(): todo lo que pinta Perfil/Configuración en una lectura.
--   · guardar_mi_perfil(...): valida edad (10–100 años) y borra el teléfono si es menor de edad.
--   · guardar_mis_notificaciones(jsonb), guardar_mi_avatar(text).
--   · cambiar_mi_tipo('student' | 'parent'): estudiante ↔ padre/tutor (maestro: después). Sus datos se conservan.
--   · eliminar_mi_cuenta(): borra la cuenta de acceso y en cascada sus datos.

begin;

-- ═════════════════════════ 1. Columnas nuevas ═════════════════════════

alter table public.profiles
  add column birth_date date,
  add column phone text check (phone is null or phone ~ '^\+?[0-9]{10,15}$'),
  add column estado text check (estado is null or length(trim(estado)) between 2 and 40),
  add column notification_prefs jsonb not null default jsonb_build_object(
    'plan', true,         -- recordatorio del examen del día del plan
    'racha', true,        -- aviso cuando la racha está por perderse
    'resultados', true,   -- resultados y logros
    'tutor_resumen', true, -- padre/tutor: resumen semanal de sus estudiantes
    'novedades', false,   -- novedades y promociones (requiere consentimiento: apagado por omisión)
    'hora', '18:00'       -- hora preferida para los recordatorios
  );

alter table public.student_profiles
  add column grado text check (grado is null or grado in (
    'secundaria_3', 'bachillerato_1', 'bachillerato_2', 'bachillerato_3', 'bachillerato_4', 'bachillerato_5',
    'bachillerato_6', 'egresado', 'universidad', 'otro'
  )),
  add column promedio numeric(4, 2) check (promedio is null or promedio between 5 and 10);

-- Edad en años cumplidos (null sin fecha).
create or replace function public.edad(p_birth date)
returns integer
language sql stable
as $$ select case when p_birth is null then null else extract(year from age(current_date, p_birth))::integer end $$;

-- ═════════════════════════ 2. Storage de fotos de perfil ═════════════════════════

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 1048576, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "avatars: sube en su carpeta" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "avatars: cambia en su carpeta" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "avatars: borra en su carpeta" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- ═════════════════════════ 3. Lectura ═════════════════════════

create or replace function public.exigir_sesion()
returns uuid
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'Inicia sesión para continuar.' using errcode = '42501';
  end if;
  return v_uid;
end;
$$;
revoke execute on function public.exigir_sesion() from public, anon, authenticated;

create or replace function public.mi_cuenta()
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_uid uuid := public.exigir_sesion();
begin
  return (
    select jsonb_build_object(
      'id', p.id,
      'email', p.email,
      'full_name', p.full_name,
      'alias', p.alias,
      'user_type', p.user_type,
      'avatar_url', p.avatar_url,
      'birth_date', p.birth_date,
      'edad', public.edad(p.birth_date),
      'phone', p.phone,
      'estado', p.estado,
      'notification_prefs', p.notification_prefs,
      'created_at', p.created_at,
      'privacy_accepted_at', p.privacy_accepted_at,
      'student', (
        select jsonb_build_object('origin_school', s.origin_school, 'not_studying', s.not_studying,
                                  'grado', s.grado, 'promedio', s.promedio)
        from public.student_profiles s where s.user_id = p.id
      ),
      -- Quién lo acompaña (estudiante) y a cuántos acompaña (padre/tutor).
      'tutores', coalesce((
        select jsonb_agg(jsonb_build_object('alias', o.alias, 'user_type', o.user_type) order by t.linked_at)
        from public.tutor_students t join public.profiles o on o.id = t.owner_id
        where t.student_id = p.id
      ), '[]'::jsonb),
      'estudiantes', (select count(*) from public.tutor_students t where t.owner_id = p.id),
      -- Licencia vigente que paga (padre/tutor o estudiante con plan propio).
      'licencia_propia', (
        select jsonb_build_object('plan', l.plan, 'seats', l.seats, 'expires_at', l.expires_at)
        from public.licenses l
        where l.owner_id = p.id and l.status = 'active' and l.expires_at > now()
        order by l.expires_at desc limit 1
      )
    )
    from public.profiles p where p.id = v_uid
  );
end;
$$;

-- ═════════════════════════ 4. Escritura ═════════════════════════

create or replace function public.guardar_mi_perfil(
  p_full_name text,
  p_alias text,
  p_birth_date date,
  p_phone text,
  p_estado text,
  p_origin_school text,
  p_not_studying boolean,
  p_grado text,
  p_promedio numeric
)
returns void
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_uid uuid := public.exigir_sesion();
  v_edad integer := public.edad(p_birth_date);
  v_phone text := nullif(regexp_replace(coalesce(p_phone, ''), '[\s\-\(\)]', '', 'g'), '');
begin
  if length(trim(coalesce(p_full_name, ''))) < 2 then
    raise exception 'Escribe tu nombre completo.' using errcode = '22023';
  end if;
  if v_edad is not null and (v_edad < 10 or v_edad > 100) then
    raise exception 'Revisa tu fecha de nacimiento.' using errcode = '22023';
  end if;
  -- Teléfono solo para mayores de edad (con fecha de nacimiento que lo demuestre).
  if v_phone is not null and (v_edad is null or v_edad < 18) then
    v_phone := null;
  end if;
  if v_phone is not null and v_phone !~ '^\+?[0-9]{10,15}$' then
    raise exception 'El teléfono debe tener 10 dígitos (o lada internacional).' using errcode = '22023';
  end if;

  update public.profiles set
    full_name = trim(p_full_name),
    alias = coalesce(nullif(trim(p_alias), ''), split_part(trim(p_full_name), ' ', 1)),
    birth_date = p_birth_date,
    phone = v_phone,
    estado = nullif(trim(coalesce(p_estado, '')), ''),
    updated_at = now()
  where id = v_uid;

  update public.student_profiles set
    origin_school = nullif(trim(coalesce(p_origin_school, '')), ''),
    not_studying = coalesce(p_not_studying, false),
    grado = nullif(p_grado, ''),
    promedio = p_promedio,
    updated_at = now()
  where user_id = v_uid;
end;
$$;

-- Solo las llaves conocidas; la hora en HH:MM.
create or replace function public.guardar_mis_notificaciones(p_prefs jsonb)
returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_uid uuid := public.exigir_sesion();
  v_actual jsonb;
  v_nuevo jsonb;
  k text;
begin
  select notification_prefs into v_actual from public.profiles where id = v_uid;
  v_nuevo := v_actual;
  foreach k in array array['plan', 'racha', 'resultados', 'tutor_resumen', 'novedades'] loop
    if jsonb_typeof(p_prefs -> k) = 'boolean' then
      v_nuevo := jsonb_set(v_nuevo, array[k], p_prefs -> k);
    end if;
  end loop;
  if (p_prefs ->> 'hora') ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then
    v_nuevo := jsonb_set(v_nuevo, '{hora}', to_jsonb(p_prefs ->> 'hora'));
  end if;
  update public.profiles set notification_prefs = v_nuevo, updated_at = now() where id = v_uid;
  return v_nuevo;
end;
$$;

-- "preset:<id>" o una URL pública de su propia carpeta en el bucket avatars; null = inicial del apodo.
create or replace function public.guardar_mi_avatar(p_avatar text)
returns void
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_uid uuid := public.exigir_sesion();
begin
  if p_avatar is not null
     and p_avatar !~ '^preset:[a-z0-9-]{1,32}$'
     and position(('/storage/v1/object/public/avatars/' || v_uid::text || '/') in p_avatar) = 0 then
    raise exception 'Imagen de perfil no válida.' using errcode = '22023';
  end if;
  update public.profiles set avatar_url = p_avatar, updated_at = now() where id = v_uid;
end;
$$;

-- Estudiante ↔ padre/tutor. Maestro y director los asigna el equipo (por ahora).
create or replace function public.cambiar_mi_tipo(p_tipo text)
returns text
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_uid uuid := public.exigir_sesion();
  v_actual text;
begin
  select user_type into v_actual from public.profiles where id = v_uid for update;
  if p_tipo not in ('student', 'parent') or v_actual not in ('student', 'parent') then
    raise exception 'Ese cambio de perfil todavía no está disponible. Escríbenos y lo hacemos por ti.' using errcode = '42501';
  end if;
  if p_tipo = v_actual then
    return v_actual;
  end if;

  if p_tipo = 'parent' then
    if exists (select 1 from public.tutor_students where student_id = v_uid) then
      raise exception 'Tu cuenta está vinculada a un tutor. Pídele que te desvincule antes de cambiar de perfil.' using errcode = '42501';
    end if;
    if exists (
      select 1 from public.license_seats s join public.licenses l on l.id = s.license_id
      where s.student_id = v_uid and s.released_at is null and l.status = 'active' and l.expires_at > now()
    ) then
      raise exception 'Tienes un plan de estudiante activo. Podrás cambiar de perfil cuando termine.' using errcode = '42501';
    end if;
  else
    if exists (select 1 from public.tutor_students where owner_id = v_uid) then
      raise exception 'Tienes estudiantes vinculados. Desvincúlalos antes de cambiar a perfil de estudiante.' using errcode = '42501';
    end if;
    if exists (select 1 from public.licenses where owner_id = v_uid and status = 'active' and expires_at > now()) then
      raise exception 'Tienes un plan de tutor activo. Podrás cambiar de perfil cuando termine.' using errcode = '42501';
    end if;
    insert into public.student_profiles (user_id) values (v_uid) on conflict (user_id) do nothing;
  end if;

  update public.profiles set user_type = p_tipo, updated_at = now() where id = v_uid;
  return p_tipo;
end;
$$;

-- Borra la cuenta de acceso; profiles y todo lo suyo se van en cascada. Admins: desde otra cuenta admin.
-- Las fotos del bucket las borra antes el cliente con la API de Storage (SQL directo sobre storage.objects está bloqueado).
create or replace function public.eliminar_mi_cuenta()
returns void
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_uid uuid := public.exigir_sesion();
begin
  if (select user_type from public.profiles where id = v_uid) = 'admin' then
    raise exception 'Una cuenta de administrador se elimina desde otra cuenta de administrador.' using errcode = '42501';
  end if;
  if exists (
    select 1 from public.licenses l join public.license_seats s on s.license_id = l.id
    where l.owner_id = v_uid and l.status = 'active' and l.expires_at > now()
      and s.released_at is null and s.student_id <> v_uid
  ) then
    raise exception 'Tu plan activo da acceso a otros estudiantes. Libera sus lugares o escríbenos antes de eliminar tu cuenta.' using errcode = '42501';
  end if;
  delete from auth.users where id = v_uid;
end;
$$;

revoke execute on function public.mi_cuenta() from public, anon;
revoke execute on function public.guardar_mi_perfil(text, text, date, text, text, text, boolean, text, numeric) from public, anon;
revoke execute on function public.guardar_mis_notificaciones(jsonb) from public, anon;
revoke execute on function public.guardar_mi_avatar(text) from public, anon;
revoke execute on function public.cambiar_mi_tipo(text) from public, anon;
revoke execute on function public.eliminar_mi_cuenta() from public, anon;
grant execute on function public.mi_cuenta() to authenticated;
grant execute on function public.guardar_mi_perfil(text, text, date, text, text, text, boolean, text, numeric) to authenticated;
grant execute on function public.guardar_mis_notificaciones(jsonb) to authenticated;
grant execute on function public.guardar_mi_avatar(text) to authenticated;
grant execute on function public.cambiar_mi_tipo(text) to authenticated;
grant execute on function public.eliminar_mi_cuenta() to authenticated;

commit;
