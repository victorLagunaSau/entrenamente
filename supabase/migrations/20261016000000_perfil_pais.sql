-- Entrena Mente · País en Mi cuenta (tabla `paises`).
-- Pegar completo en Supabase → SQL Editor → Run. Va en una transacción: si algo falla, no cambia nada.
--
--   · mi_cuenta(): ahora devuelve `pais` (profiles.pais).
--   · guardar_mi_perfil(...): recibe p_pais (código de `paises`, activo) y lo guarda; null = sin especificar.
--     La firma cambia, así que se borra la versión anterior.
--   · El teléfono se guarda con la lada del país (+52…, +502…, +1…).

begin;

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
      'pais', p.pais,
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

drop function if exists public.guardar_mi_perfil(text, text, date, text, text, text, boolean, text, numeric);

create or replace function public.guardar_mi_perfil(
  p_full_name text,
  p_alias text,
  p_birth_date date,
  p_phone text,
  p_estado text,
  p_origin_school text,
  p_not_studying boolean,
  p_grado text,
  p_promedio numeric,
  p_pais text
)
returns void
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_uid uuid := public.exigir_sesion();
  v_edad integer := public.edad(p_birth_date);
  v_phone text := nullif(regexp_replace(coalesce(p_phone, ''), '[\s\-\(\)]', '', 'g'), '');
  v_grado text := coalesce(nullif(p_grado, ''), 'pu');
  v_pais text := upper(nullif(trim(coalesce(p_pais, '')), ''));
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
    raise exception 'Revisa tu teléfono: solo números, con la lada de tu país.' using errcode = '22023';
  end if;
  if v_pais is not null and not exists (select 1 from public.paises p where p.codigo = v_pais and p.activo) then
    raise exception 'Elige un país de la lista.' using errcode = '22023';
  end if;
  if not exists (select 1 from public.grados g where g.codigo = v_grado and g.activo) then
    raise exception 'Elige un grado de la lista.' using errcode = '22023';
  end if;

  update public.profiles set
    full_name = trim(p_full_name),
    alias = coalesce(nullif(trim(p_alias), ''), split_part(trim(p_full_name), ' ', 1)),
    birth_date = p_birth_date,
    phone = v_phone,
    estado = nullif(trim(coalesce(p_estado, '')), ''),
    pais = v_pais,
    updated_at = now()
  where id = v_uid;

  update public.student_profiles set
    origin_school = nullif(trim(coalesce(p_origin_school, '')), ''),
    not_studying = coalesce(p_not_studying, false),
    grado = v_grado,
    promedio = p_promedio,
    updated_at = now()
  where user_id = v_uid;
end;
$$;

revoke execute on function public.guardar_mi_perfil(text, text, date, text, text, text, boolean, text, numeric, text) from public, anon;
grant execute on function public.guardar_mi_perfil(text, text, date, text, text, text, boolean, text, numeric, text) to authenticated;

commit;
