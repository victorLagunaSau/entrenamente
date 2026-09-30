-- Entrena Mente · Administración de usuarios y licencias (/admin/users).
--
-- Se corre DESPUÉS de 20260929040000_plan_prueba_solo_admin.sql.
-- Pegar completo en Supabase → SQL Editor → Run. Todo va en una transacción: si algo falla, no cambia nada.
--
-- Reemplaza los DELETE/UPDATE a mano en el SQL Editor. Todas las funciones exigen ser administrador:
--   · admin_buscar_usuarios(q): por correo, nombre, apodo o ID (mínimo 3 letras, máximo 50 resultados).
--   · admin_usuario(id): ficha completa (perfil, licencias propias con sus lugares, lugar que ocupa, vínculos).
--   · admin_cambiar_tipo_usuario(id, tipo): estudiante, padre, maestro, director o admin.
--   · admin_otorgar_licencia(...): licencia de cortesía (source admin). Si el dueño es estudiante ocupa su lugar;
--     si es padre/maestro, sus estudiantes vinculados sin acceso ocupan los lugares.
--   · admin_editar_licencia(...): tipo, lugares, vencimiento, estado y motivo.
--   · admin_borrar_licencia(id): sus lugares se van con ella (el estudiante vuelve a demo; su historial se queda).
--   · admin_borrar_usuario(id): borra la cuenta de acceso (auth.users) y en cascada todos sus datos.

begin;

create or replace function public.exigir_admin()
returns uuid
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Solo los administradores pueden hacer esto.' using errcode = '42501';
  end if;
  return (select auth.uid());
end;
$$;

-- Resumen de una licencia con sus lugares ocupados (lo usan la búsqueda y la ficha).
create or replace function public.admin_licencia_json(p_license public.licenses)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'id', p_license.id,
    'plan', p_license.plan,
    'seats', p_license.seats,
    'source', p_license.source,
    'status', p_license.status,
    'starts_at', p_license.starts_at,
    'expires_at', p_license.expires_at,
    'vigente', p_license.status = 'active' and p_license.expires_at > now(),
    'granted_reason', p_license.granted_reason,
    'coupon_code', p_license.coupon_code,
    'ocupados', coalesce((
      select jsonb_agg(jsonb_build_object('id', p.id, 'alias', p.alias, 'full_name', p.full_name, 'email', p.email)
                       order by s.assigned_at)
      from public.license_seats s join public.profiles p on p.id = s.student_id
      where s.license_id = p_license.id and s.released_at is null
    ), '[]'::jsonb)
  );
$$;

create or replace function public.admin_buscar_usuarios(p_q text)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_q text := trim(coalesce(p_q, ''));
  v_id uuid;
begin
  perform public.exigir_admin();
  if length(v_q) < 3 then
    raise exception 'Escribe al menos 3 letras del correo, nombre o ID.' using errcode = '22023';
  end if;
  begin
    v_id := v_q::uuid;
  exception when invalid_text_representation then
    v_id := null;
  end;

  return coalesce((
    select jsonb_agg(u order by u->>'email')
    from (
      select jsonb_build_object(
        'id', p.id,
        'email', p.email,
        'full_name', p.full_name,
        'alias', p.alias,
        'user_type', p.user_type,
        'created_at', p.created_at,
        -- Acceso vigente: el lugar que ocupa (estudiante) o la mejor licencia propia (padre/maestro).
        'acceso', coalesce(
          (select jsonb_build_object('plan', l.plan, 'expires_at', l.expires_at, 'propia', l.owner_id = p.id)
           from public.license_seats s join public.licenses l on l.id = s.license_id
           where s.student_id = p.id and s.released_at is null and l.status = 'active' and l.expires_at > now()
           limit 1),
          (select jsonb_build_object('plan', l.plan, 'expires_at', l.expires_at, 'propia', true)
           from public.licenses l
           where l.owner_id = p.id and l.status = 'active' and l.expires_at > now()
           order by l.seats desc limit 1)
        )
      ) as u
      from public.profiles p
      where (v_id is not null and p.id = v_id)
         or p.email ilike '%' || v_q || '%'
         or p.full_name ilike '%' || v_q || '%'
         or p.alias ilike '%' || v_q || '%'
      order by p.email
      limit 50
    ) r
  ), '[]'::jsonb);
end;
$$;

create or replace function public.admin_usuario(p_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_p public.profiles;
begin
  perform public.exigir_admin();
  select * into v_p from public.profiles where id = p_id;
  if not found then
    raise exception 'Ese usuario ya no existe.' using errcode = 'P0002';
  end if;

  return jsonb_build_object(
    'id', v_p.id,
    'email', v_p.email,
    'full_name', v_p.full_name,
    'alias', v_p.alias,
    'user_type', v_p.user_type,
    'created_at', v_p.created_at,
    'ultimo_acceso', (select last_sign_in_at from auth.users where id = p_id),
    'estudiante', (
      select jsonb_build_object(
        'free_exams_used', sp.free_exams_used,
        'free_exams_granted', sp.free_exams_granted,
        'free_trial_ends_at', sp.free_trial_ends_at
      )
      from public.student_profiles sp where sp.user_id = p_id
    ),
    'examenes', (select count(*) from public.exam_history where student_id = p_id),
    'licencias', coalesce((
      select jsonb_agg(public.admin_licencia_json(l) order by l.created_at desc)
      from public.licenses l where l.owner_id = p_id
    ), '[]'::jsonb),
    -- Lugar vigente en la licencia de otra persona (padre, maestro, escuela).
    'lugar', (
      select jsonb_build_object('license_id', l.id, 'plan', l.plan, 'expires_at', l.expires_at,
                                'vigente', l.status = 'active' and l.expires_at > now(),
                                'dueno', jsonb_build_object('id', o.id, 'alias', o.alias, 'email', o.email))
      from public.license_seats s
      join public.licenses l on l.id = s.license_id
      join public.profiles o on o.id = l.owner_id
      where s.student_id = p_id and s.released_at is null and l.owner_id <> p_id
      limit 1
    ),
    'tutores', coalesce((
      select jsonb_agg(jsonb_build_object('id', o.id, 'alias', o.alias, 'email', o.email, 'user_type', o.user_type))
      from public.tutor_students t join public.profiles o on o.id = t.owner_id
      where t.student_id = p_id
    ), '[]'::jsonb),
    'estudiantes', coalesce((
      select jsonb_agg(jsonb_build_object('id', s.id, 'alias', s.alias, 'email', s.email) order by t.linked_at)
      from public.tutor_students t join public.profiles s on s.id = t.student_id
      where t.owner_id = p_id
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.admin_cambiar_tipo_usuario(p_id uuid, p_tipo text)
returns void
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_admin uuid := public.exigir_admin();
begin
  if p_tipo not in ('student', 'parent', 'teacher', 'director', 'admin') then
    raise exception 'Tipo de usuario no válido.' using errcode = '22023';
  end if;
  if p_id = v_admin then
    raise exception 'No puedes cambiar tu propio tipo de usuario.' using errcode = '42501';
  end if;

  update public.profiles set user_type = p_tipo where id = p_id;
  if not found then
    raise exception 'Ese usuario ya no existe.' using errcode = 'P0002';
  end if;

  -- Un estudiante siempre tiene su ficha (pruebas gratis, periodo de prueba) con los valores de alta.
  if p_tipo = 'student' then
    insert into public.student_profiles (user_id) values (p_id) on conflict (user_id) do nothing;
  end if;
end;
$$;

create or replace function public.admin_otorgar_licencia(
  p_owner uuid,
  p_plan text,
  p_seats integer,
  p_dias integer,
  p_motivo text
)
returns uuid
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_admin uuid := public.exigir_admin();
  v_tipo text;
  v_license uuid;
begin
  select user_type into v_tipo from public.profiles where id = p_owner;
  if not found then
    raise exception 'Ese usuario ya no existe.' using errcode = 'P0002';
  end if;
  if nullif(trim(p_motivo), '') is null then
    raise exception 'Escribe el motivo de la licencia ("Gratis por:").' using errcode = '22023';
  end if;
  if coalesce(p_dias, 0) < 1 then
    raise exception 'La licencia debe durar al menos 1 día.' using errcode = '22023';
  end if;

  insert into public.licenses (owner_id, plan, seats, source, status, expires_at, granted_reason, authorized_by)
  values (p_owner, p_plan, p_seats, 'admin', 'active', now() + make_interval(days => p_dias), trim(p_motivo), v_admin)
  returning id into v_license;

  if v_tipo = 'student' then
    perform public.assign_seat(v_license, p_owner);
  else
    perform public.assign_seat(v_license, t.student_id)
    from public.tutor_students t
    where t.owner_id = p_owner
    order by t.linked_at;
  end if;

  return v_license;
end;
$$;

create or replace function public.admin_editar_licencia(
  p_id uuid,
  p_plan text,
  p_seats integer,
  p_expires_at timestamptz,
  p_status text,
  p_motivo text
)
returns void
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_admin uuid := public.exigir_admin();
  v_used integer;
begin
  select count(*) into v_used from public.license_seats where license_id = p_id and released_at is null;
  if p_seats < v_used then
    raise exception 'La licencia tiene % lugares ocupados; libera alguno antes de bajar a %.', v_used, p_seats
      using errcode = '22023';
  end if;

  update public.licenses
  set plan = p_plan,
      seats = p_seats,
      expires_at = p_expires_at,
      status = p_status,
      granted_reason = coalesce(nullif(trim(p_motivo), ''), granted_reason),
      authorized_by = case when source = 'admin' then coalesce(authorized_by, v_admin) else authorized_by end
  where id = p_id;
  if not found then
    raise exception 'Esa licencia ya no existe.' using errcode = 'P0002';
  end if;
end;
$$;

create or replace function public.admin_borrar_licencia(p_id uuid)
returns void
language plpgsql volatile security definer set search_path = ''
as $$
begin
  perform public.exigir_admin();
  delete from public.licenses where id = p_id;
  if not found then
    raise exception 'Esa licencia ya no existe.' using errcode = 'P0002';
  end if;
end;
$$;

-- Borra la cuenta de acceso; profiles y todo lo que cuelga de él (metas, licencias, lugares, exámenes, planes,
-- vínculos de tutor, invitaciones) se va en cascada. No se puede deshacer.
create or replace function public.admin_borrar_usuario(p_id uuid)
returns void
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_admin uuid := public.exigir_admin();
begin
  if p_id = v_admin then
    raise exception 'No puedes borrar tu propia cuenta desde aquí.' using errcode = '42501';
  end if;
  delete from auth.users where id = p_id;
  if not found then
    -- Perfil huérfano (sin cuenta de acceso): se borra directo.
    delete from public.profiles where id = p_id;
    if not found then
      raise exception 'Ese usuario ya no existe.' using errcode = 'P0002';
    end if;
  end if;
end;
$$;

revoke execute on function public.exigir_admin() from public, anon, authenticated;
revoke execute on function public.admin_licencia_json(public.licenses) from public, anon, authenticated;
revoke execute on function public.admin_buscar_usuarios(text) from public, anon;
revoke execute on function public.admin_usuario(uuid) from public, anon;
revoke execute on function public.admin_cambiar_tipo_usuario(uuid, text) from public, anon;
revoke execute on function public.admin_otorgar_licencia(uuid, text, integer, integer, text) from public, anon;
revoke execute on function public.admin_editar_licencia(uuid, text, integer, timestamptz, text, text) from public, anon;
revoke execute on function public.admin_borrar_licencia(uuid) from public, anon;
revoke execute on function public.admin_borrar_usuario(uuid) from public, anon;
grant execute on function public.admin_buscar_usuarios(text) to authenticated;
grant execute on function public.admin_usuario(uuid) to authenticated;
grant execute on function public.admin_cambiar_tipo_usuario(uuid, text) to authenticated;
grant execute on function public.admin_otorgar_licencia(uuid, text, integer, integer, text) to authenticated;
grant execute on function public.admin_editar_licencia(uuid, text, integer, timestamptz, text, text) to authenticated;
grant execute on function public.admin_borrar_licencia(uuid) to authenticated;
grant execute on function public.admin_borrar_usuario(uuid) to authenticated;

commit;
