-- Entrena Mente · Invitaciones del padre/tutor: un enlace por estudiante, con meta opcional.
--
-- Se corre DESPUÉS de 20260929050000_admin_usuarios.sql.
-- Pegar completo en Supabase → SQL Editor → Run. Todo va en una transacción: si algo falla, no cambia nada.
--
-- Qué cambia:
--   · invites: cada invitación es de UN estudiante (un solo uso). La universidad y la carrera son opcionales:
--     si el tutor las elige, el estudiante las hereda y se salta esos pasos; si no, las elige él.
--     Nuevas columnas `label` (para quién es: "Ana", "Lista 12") y `group_id` (al registrarse entra a ese grupo).
--   · handle_new_user(): el padre sale del registro con la invitación de su primer hijo (con la meta que eligió).
--     Al canjearse, el estudiante ocupa un lugar de la licencia del enlace o, si el padre pagó después de
--     compartirlo, de su licencia vigente; y entra al grupo de la invitación.
--   · Las invitaciones pendientes cuentan contra el límite del plan: lugares libres = cupos − vinculados − pendientes.
--   · Nuevas RPC del panel: invitaciones_tutor(), crear_invitaciones_tutor(jsonb) (una o muchas, p. ej. un
--     maestro con 20+ alumnos), crear_invitacion_tutor() y cancelar_invitacion_tutor().
--   · get_invite(): "sponsored" también cuenta la licencia vigente del padre.
--   · invitacion_tutor() (enlace reutilizable sin meta) se queda para el enlace de grupo de maestros.

begin;

-- ═════════════════════════ 1. Invitaciones ═════════════════════════

alter table public.invites
  add column label text check (label is null or length(trim(label)) between 1 and 60),
  add column group_id bigint references public.tutor_groups(id) on delete set null;

-- ═════════════════════════ 2. Utilidades ═════════════════════════

-- Licencia vigente del tutor (null si no tiene).
create or replace function public.licencia_vigente_tutor(p_owner uuid)
returns uuid
language sql stable security definer set search_path = ''
as $$
  select l.id from public.licenses l
  where l.owner_id = p_owner and l.status = 'active' and l.expires_at > now()
  order by l.seats desc, l.expires_at desc
  limit 1;
$$;

-- Invitaciones de un estudiante que aún no se canjean ni vencen.
create or replace function public.invitaciones_pendientes(p_owner uuid)
returns integer
language sql stable security definer set search_path = ''
as $$
  select count(*)::integer from public.invites
  where parent_id = p_owner and not reusable and redeemed_by is null and expires_at > now();
$$;

-- Lugares para invitar: cupos del plan − estudiantes vinculados − invitaciones pendientes.
create or replace function public.lugares_para_invitar(p_owner uuid)
returns integer
language sql stable security definer set search_path = ''
as $$
  select greatest(
    public.limite_estudiantes_tutor(p_owner)
      - (select count(*)::integer from public.tutor_students where owner_id = p_owner)
      - public.invitaciones_pendientes(p_owner),
    0);
$$;

-- ═════════════════════════ 3. Consultar invitación ═════════════════════════

create or replace function public.get_invite(p_code text)
returns table (code text, parent_name text, university_id text, career_id text, sponsored boolean)
language sql stable security definer set search_path = ''
as $$
  select i.code, p.full_name, i.university_id, i.career_id,
         coalesce((
           select (select count(*) from public.license_seats s
                   where s.license_id = l.id and s.released_at is null) < l.seats
           from public.licenses l
           where l.id = coalesce(i.license_id, public.licencia_vigente_tutor(i.parent_id))
             and l.status = 'active' and l.expires_at > now()
         ), false)
  from public.invites i
  join public.profiles p on p.id = i.parent_id
  where i.code = upper(trim(p_code)) and (i.reusable or i.redeemed_by is null) and i.expires_at > now()
    and (not i.reusable or not public.tutor_lleno(i.parent_id));
$$;

-- ═════════════════════════ 4. Alta automática (reemplaza la de 20260929000000) ═════════════════════════

create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  -- Desde el registro solo se crean estudiantes o padres; el resto de roles los asigna un admin.
  v_type text := case when meta->>'user_type' = 'parent' then 'parent' else 'student' end;
  v_full_name text := coalesce(nullif(trim(meta->>'full_name'), ''), nullif(trim(meta->>'name'), ''), '');
  v_alias text := nullif(trim(meta->>'alias'), '');
  v_accepted boolean := coalesce(meta->>'accepted_privacy', 'false') = 'true';
  v_university text := nullif(meta->>'university_id', '');
  v_career text := nullif(meta->>'career_id', '');
  v_invite public.invites;
  v_license uuid;
begin
  -- Apodo automático: primer nombre o, si no hay nombre (p. ej. Google sin nombre), la parte local del correo.
  v_alias := coalesce(v_alias, nullif(split_part(v_full_name, ' ', 1), ''), split_part(coalesce(new.email, ''), '@', 1));

  if v_type = 'student' and nullif(meta->>'invite_code', '') is not null then
    select * into v_invite from public.invites
    where code = upper(meta->>'invite_code') and (reusable or redeemed_by is null) and expires_at > now()
    for update;
  end if;

  insert into public.profiles (id, email, full_name, alias, user_type, privacy_accepted_at, privacy_version)
  values (
    new.id,
    coalesce(new.email, ''),
    v_full_name,
    v_alias,
    v_type,
    case when v_accepted then now() end,
    case when v_accepted then nullif(meta->>'privacy_version', '') end
  );

  if v_type = 'student' then
    insert into public.student_profiles (user_id, origin_school, not_studying)
    values (
      new.id,
      nullif(trim(meta->>'origin_school'), ''),
      coalesce(meta->>'not_studying', 'false') = 'true'
    );
  end if;

  if v_invite.code is not null then
    update public.invites
    set uses = uses + 1,
        redeemed_by = case when reusable then redeemed_by else new.id end,
        redeemed_at = case when reusable then redeemed_at else now() end
    where code = v_invite.code;

    insert into public.tutor_students (owner_id, student_id, group_id)
    values (v_invite.parent_id, new.id, v_invite.group_id)
    on conflict do nothing;

    -- La meta del tutor manda; si la invitación no trae meta, se respeta la que eligió el alumno.
    if v_invite.university_id is not null then
      v_university := v_invite.university_id;
      v_career := v_invite.career_id;
    end if;
    -- La licencia del enlace o, si se compartió antes de pagar, la vigente del tutor.
    -- assign_seat solo enciende el acceso si hay lugar libre.
    v_license := coalesce(v_invite.license_id, public.licencia_vigente_tutor(v_invite.parent_id));
    if v_license is not null then
      perform public.assign_seat(v_license, new.id);
    end if;
  end if;

  if v_type = 'student' and v_university is not null and v_career is not null then
    insert into public.student_goals (user_id, university_id, career_id, is_initial)
    values (new.id, v_university, v_career, true);
  end if;

  -- El padre sale del registro con la invitación de su primer hijo, con la meta que eligió.
  if v_type = 'parent' and v_university is not null and v_career is not null
     and nullif(meta->>'new_invite_code', '') is not null then
    insert into public.invites (code, parent_id, university_id, career_id, expires_at)
    values (upper(meta->>'new_invite_code'), new.id, v_university, v_career, now() + interval '90 days');
  end if;

  return new;
end;
$$;

-- ═════════════════════════ 5. Invitaciones del panel ═════════════════════════

-- Pendientes del tutor, la más nueva primero.
create or replace function public.invitaciones_tutor()
returns table (
  code text, label text, university_id text, career_id text, group_id bigint,
  created_at timestamptz, expires_at timestamptz
)
language sql stable security definer set search_path = ''
as $$
  select i.code, i.label, i.university_id, i.career_id, i.group_id, i.created_at, i.expires_at
  from public.invites i
  where i.parent_id = public.exigir_tutor() and not i.reusable and i.redeemed_by is null and i.expires_at > now()
  order by i.created_at desc;
$$;

-- Crea una o muchas invitaciones de un solo uso.
-- p_items: [{ "label": "Ana", "university_id": "unam", "career_id": "unam-medicina", "group_id": 3 }, …]
-- Todos los campos son opcionales; universidad y carrera van juntas o ninguna.
create or replace function public.crear_invitaciones_tutor(p_items jsonb)
returns table (code text)
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := public.exigir_tutor();
  v_n integer := coalesce(jsonb_array_length(p_items), 0);
  v_libres integer;
  v_item jsonb;
  v_university text;
  v_career text;
  v_group bigint;
  v_code text;
begin
  if jsonb_typeof(p_items) <> 'array' or v_n = 0 then
    raise exception 'Indica al menos una invitación.' using errcode = '22023';
  end if;
  if v_n > 200 then
    raise exception 'Máximo 200 invitaciones a la vez.' using errcode = '22023';
  end if;

  -- Bloquea al tutor para que dos pestañas no rebasen el límite al mismo tiempo.
  perform 1 from public.profiles where id = v_uid for update;
  v_libres := public.lugares_para_invitar(v_uid);
  if v_n > v_libres then
    raise exception '%', case
      when v_libres = 0 then 'Ya usaste todos los lugares de tu plan. Cancela una invitación pendiente o amplía tu plan.'
      else format('Solo te quedan %s lugares en tu plan.', v_libres) end
      using errcode = 'P0001';
  end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_university := nullif(trim(v_item->>'university_id'), '');
    v_career := nullif(trim(v_item->>'career_id'), '');
    v_group := nullif(v_item->>'group_id', '')::bigint;
    if (v_university is null) <> (v_career is null) then
      raise exception 'Elige universidad y carrera, o deja que el estudiante las elija.' using errcode = '22023';
    end if;
    if v_group is not null and not exists (select 1 from public.tutor_groups where id = v_group and owner_id = v_uid) then
      raise exception 'El grupo no es de este tutor.' using errcode = '42501';
    end if;

    v_code := public.nuevo_codigo_invitacion();
    insert into public.invites (code, parent_id, license_id, university_id, career_id, label, group_id, expires_at)
    values (v_code, v_uid, public.licencia_vigente_tutor(v_uid), v_university, v_career,
            nullif(trim(v_item->>'label'), ''), v_group, now() + interval '90 days');
    code := v_code;
    return next;
  end loop;
end;
$$;

-- Atajo para una sola invitación (el panel del padre).
create or replace function public.crear_invitacion_tutor(
  p_university text default null, p_career text default null, p_label text default null, p_group bigint default null
)
returns text
language sql security definer set search_path = ''
as $$
  select code from public.crear_invitaciones_tutor(jsonb_build_array(jsonb_build_object(
    'university_id', p_university, 'career_id', p_career, 'label', p_label, 'group_id', p_group
  )));
$$;

-- Cancelar una invitación pendiente libera su lugar.
create or replace function public.cancelar_invitacion_tutor(p_code text)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  update public.invites set expires_at = now()
  where code = upper(trim(p_code)) and parent_id = public.exigir_tutor()
    and not reusable and redeemed_by is null and expires_at > now();
  if not found then
    raise exception 'Esa invitación ya no está pendiente.' using errcode = 'P0002';
  end if;
end;
$$;

-- ═════════════════════════ 6. Permisos ═════════════════════════

revoke execute on function public.licencia_vigente_tutor(uuid) from public, anon, authenticated;
revoke execute on function public.invitaciones_pendientes(uuid) from public, anon, authenticated;
revoke execute on function public.lugares_para_invitar(uuid) from public, anon, authenticated;
revoke execute on function public.invitaciones_tutor() from public, anon;
revoke execute on function public.crear_invitaciones_tutor(jsonb) from public, anon;
revoke execute on function public.crear_invitacion_tutor(text, text, text, bigint) from public, anon;
revoke execute on function public.cancelar_invitacion_tutor(text) from public, anon;
grant execute on function public.invitaciones_tutor() to authenticated;
grant execute on function public.crear_invitaciones_tutor(jsonb) to authenticated;
grant execute on function public.crear_invitacion_tutor(text, text, text, bigint) to authenticated;
grant execute on function public.cancelar_invitacion_tutor(text) to authenticated;

commit;
