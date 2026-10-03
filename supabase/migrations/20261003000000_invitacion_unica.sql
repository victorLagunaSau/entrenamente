-- Entrena Mente · Invitación única del padre/tutor: un solo enlace que hereda la meta y la licencia.
--
-- Se corre DESPUÉS de 20260929050000_admin_usuarios.sql.
-- Pegar completo en Supabase → SQL Editor → Run. Todo va en una transacción: si algo falla, no cambia nada.
--
-- Antes había dos enlaces: el del registro del padre (un solo uso, con universidad y carrera, sin licencia)
-- y el del panel (reutilizable, con licencia, sin universidad ni carrera). Ahora:
--   · handle_new_user(): el padre que se registra recibe directo su enlace reutilizable, con la meta que eligió.
--     El estudiante que entra con cualquier enlace del padre hereda esa meta y, si el padre tiene una licencia
--     vigente con lugar libre (aunque la haya activado después de compartir el enlace), ocupa ese lugar.
--   · invitacion_tutor(): el panel entrega ese mismo enlace; si genera uno nuevo, copia la meta del padre.
--   · get_invite(): "sponsored" también cuenta la licencia vigente del padre, no solo la del enlace.

begin;

-- ═════════════════════════ 1. Utilidades ═════════════════════════

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

-- ═════════════════════════ 2. Consultar invitación ═════════════════════════

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

-- ═════════════════════════ 3. Alta automática (reemplaza la de 20260929000000) ═════════════════════════

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

    insert into public.tutor_students (owner_id, student_id) values (v_invite.parent_id, new.id)
    on conflict do nothing;

    -- La meta del padre manda; si el enlace no trae meta, se respeta la que eligió el alumno.
    if v_invite.university_id is not null then
      v_university := v_invite.university_id;
      v_career := v_invite.career_id;
    end if;
    -- La licencia del enlace o, si se compartió antes de pagar, la vigente del padre.
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

  -- El padre sale del registro con su enlace reutilizable: es el mismo que verá en su panel.
  if v_type = 'parent' and v_university is not null and v_career is not null
     and nullif(meta->>'new_invite_code', '') is not null then
    insert into public.invites (code, parent_id, university_id, career_id, reusable, expires_at)
    values (upper(meta->>'new_invite_code'), new.id, v_university, v_career, true, now() + interval '90 days');
  end if;

  return new;
end;
$$;

-- ═════════════════════════ 4. Enlace del panel (reemplaza la de 20260929020000) ═════════════════════════

create or replace function public.invitacion_tutor(p_nuevo boolean default false)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := public.exigir_tutor();
  v_license uuid := public.licencia_vigente_tutor(v_uid);
  v_meta public.invites;
  v_code text;
begin
  if public.tutor_lleno(v_uid) then
    raise exception 'Ya tienes el máximo de estudiantes de tu plan. Amplía tu plan para invitar a otro.' using errcode = 'P0001';
  end if;

  if p_nuevo then
    update public.invites set expires_at = now()
    where parent_id = v_uid and reusable and expires_at > now();
  else
    -- El enlace vigente sirve aunque se haya creado antes de pagar: al canjearse usa la licencia vigente.
    select code into v_code from public.invites
    where parent_id = v_uid and reusable and expires_at > now()
      and (license_id is null or license_id is not distinct from v_license)
    order by created_at desc limit 1;
    if v_code is not null then
      return v_code;
    end if;
  end if;

  -- La meta que eligió el padre al registrarse viaja a cada enlace nuevo.
  select * into v_meta from public.invites
  where parent_id = v_uid and university_id is not null
  order by created_at desc limit 1;

  v_code := public.nuevo_codigo_invitacion();
  insert into public.invites (code, parent_id, license_id, reusable, expires_at, university_id, career_id)
  values (v_code, v_uid, v_license, true,
          -- least() ignora el null: sin licencia, 90 días.
          least((select expires_at from public.licenses where id = v_license), now() + interval '90 days'),
          v_meta.university_id, v_meta.career_id);
  return v_code;
end;
$$;

revoke execute on function public.licencia_vigente_tutor(uuid) from public, anon, authenticated;

commit;
