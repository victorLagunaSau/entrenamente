-- Entrena Mente · Home Padre / Maestro (/app/dashboard): estudiantes, grupos, estadísticas y suscripción.
--
-- Se corre DESPUÉS de 20260928070000_precio_mensual_97.sql.
-- Pegar completo en Supabase → SQL Editor → Run. Todo va en una transacción: si algo falla, no cambia nada.
--
-- Qué agrega:
--   · tutor_students: el vínculo permanente tutor ↔ estudiante (sobrevive a que la licencia venza; así el
--     tutor ve a sus estudiantes "inactivos" y los recupera al renovar). Se crea al registrarse con invitación.
--   · tutor_groups: etiquetas del tutor (Tercero A, Hijos…); cada estudiante vinculado está en un grupo o en ninguno.
--   · invites: ahora pueden ser "de licencia" (reutilizables y sin meta: el estudiante elige su escuela y carrera
--     en el registro). La del registro de padres (una meta, un solo uso) sigue igual.
--   · handle_new_user(): usa la invitación reutilizable, crea el vínculo y respeta la meta que eligió el alumno
--     cuando la invitación no trae una.
--   · panel_tutor(): todo lo que pinta el home (licencia, cupos, grupos, estudiantes).
--   · invitacion_tutor(): el enlace vigente de la licencia (o uno nuevo).
--   · crear/renombrar/borrar grupo, asignar_grupo_tutor(), activar/liberar lugar, desvincular estudiante.
--   · estadisticas_tutor(): los exámenes congelados de sus estudiantes (sin las preguntas: solo resumen por materia).
--
-- Todas las escrituras pasan por funciones `security definer` que validan que el estudiante sea del tutor.

begin;

-- ═════════════════════════ 1. Tablas ═════════════════════════

create table public.tutor_groups (
  id bigint generated always as identity primary key,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 40),
  created_at timestamptz not null default now()
);
create unique index tutor_groups_nombre_unico on public.tutor_groups (owner_id, lower(trim(name)));

create table public.tutor_students (
  owner_id uuid not null references public.profiles(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  group_id bigint references public.tutor_groups(id) on delete set null,
  linked_at timestamptz not null default now(),
  primary key (owner_id, student_id),
  check (owner_id <> student_id)
);
create index tutor_students_student_idx on public.tutor_students (student_id);

-- El grupo debe ser del mismo tutor (lo validan las funciones; esto es la red de seguridad).
create or replace function public.tutor_students_grupo_propio()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.group_id is not null
     and not exists (select 1 from public.tutor_groups g where g.id = new.group_id and g.owner_id = new.owner_id) then
    raise exception 'El grupo no es de este tutor.' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger tutor_students_grupo before insert or update of group_id on public.tutor_students
  for each row execute function public.tutor_students_grupo_propio();

alter table public.tutor_groups enable row level security;
alter table public.tutor_students enable row level security;

create policy "tutor_groups: dueño o admin ve" on public.tutor_groups
  for select to authenticated using (owner_id = (select auth.uid()) or public.is_admin());
create policy "tutor_students: tutor, estudiante o admin ve" on public.tutor_students
  for select to authenticated
  using (owner_id = (select auth.uid()) or student_id = (select auth.uid()) or public.is_admin());

revoke all on public.tutor_groups, public.tutor_students from anon, authenticated;
grant select on public.tutor_groups, public.tutor_students to authenticated;

-- Vínculos que ya existen: invitaciones canjeadas y lugares ocupados en licencias de otra persona.
insert into public.tutor_students (owner_id, student_id, linked_at)
select parent_id, redeemed_by, coalesce(redeemed_at, created_at)
from public.invites
where redeemed_by is not null and redeemed_by <> parent_id
on conflict do nothing;

insert into public.tutor_students (owner_id, student_id, linked_at)
select l.owner_id, s.student_id, min(s.assigned_at)
from public.license_seats s
join public.licenses l on l.id = s.license_id
where l.owner_id <> s.student_id
group by l.owner_id, s.student_id
on conflict do nothing;

-- ═════════════════════════ 2. Invitaciones de licencia ═════════════════════════

alter table public.invites
  alter column university_id drop not null,
  alter column career_id drop not null,
  add column reusable boolean not null default false,
  add column uses integer not null default 0 check (uses >= 0),
  add constraint invites_meta_completa check ((university_id is null) = (career_id is null));

-- Las de un solo uso que ya se canjearon cuentan como usadas.
update public.invites set uses = 1 where redeemed_by is not null;

create index invites_licencia_vigente on public.invites (parent_id, license_id) where reusable;

-- Invitación pública: las reutilizables siguen válidas aunque alguien ya las haya usado.
create or replace function public.get_invite(p_code text)
returns table (code text, parent_name text, university_id text, career_id text, sponsored boolean)
language sql stable security definer set search_path = ''
as $$
  select i.code, p.full_name, i.university_id, i.career_id,
         coalesce((
           select l.status = 'active' and l.expires_at > now()
                  and (select count(*) from public.license_seats s
                       where s.license_id = l.id and s.released_at is null) < l.seats
           from public.licenses l where l.id = i.license_id
         ), false)
  from public.invites i
  join public.profiles p on p.id = i.parent_id
  where i.code = upper(trim(p_code)) and (i.reusable or i.redeemed_by is null) and i.expires_at > now();
$$;

-- ═════════════════════════ 3. Alta automática (reemplaza la de 20260926000000) ═════════════════════════

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

    -- La invitación de licencia no trae meta: se respeta la que eligió el alumno en el registro.
    if v_invite.university_id is not null then
      v_university := v_invite.university_id;
      v_career := v_invite.career_id;
    end if;
    -- Enciende el interruptor solo si la licencia del tutor tiene lugar libre.
    if v_invite.license_id is not null then
      perform public.assign_seat(v_invite.license_id, new.id);
    end if;
  end if;

  if v_type = 'student' and v_university is not null and v_career is not null then
    insert into public.student_goals (user_id, university_id, career_id, is_initial)
    values (new.id, v_university, v_career, true);
  end if;

  if v_type = 'parent' and v_university is not null and v_career is not null
     and nullif(meta->>'new_invite_code', '') is not null then
    insert into public.invites (code, parent_id, university_id, career_id)
    values (upper(meta->>'new_invite_code'), new.id, v_university, v_career);
  end if;

  return new;
end;
$$;

-- ═════════════════════════ 4. Utilidades internas ═════════════════════════

-- Padres, maestros, directores y admins (en vista previa) usan el home de tutor. Los estudiantes no.
create or replace function public.exigir_tutor()
returns uuid
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'Inicia sesión.' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.profiles where id = v_uid and user_type in ('parent', 'teacher', 'director', 'admin')
  ) then
    raise exception 'Solo padres, tutores y maestros usan este panel.' using errcode = '42501';
  end if;
  return v_uid;
end;
$$;

-- La licencia que gobierna el panel: la vigente de más cupos; si no hay, la que venció más recientemente.
create or replace function public.licencia_tutor(p_owner uuid)
returns public.licenses
language sql stable security definer set search_path = ''
as $$
  select l.* from public.licenses l
  where l.owner_id = p_owner
  order by (l.status = 'active' and l.expires_at > now()) desc, l.seats desc, l.expires_at desc
  limit 1;
$$;

create or replace function public.exigir_estudiante_del_tutor(p_owner uuid, p_student uuid)
returns void
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not exists (select 1 from public.tutor_students where owner_id = p_owner and student_id = p_student) then
    raise exception 'Este estudiante no está vinculado a tu cuenta.' using errcode = '42501';
  end if;
end;
$$;

-- Mismo alfabeto que valida invites.code (sin I, O, 0 ni 1).
create or replace function public.nuevo_codigo_invitacion()
returns text
language plpgsql volatile set search_path = ''
as $$
declare
  v_code text;
begin
  loop
    select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 1 + floor(random() * 32)::int, 1), '')
    into v_code from generate_series(1, 8);
    exit when not exists (select 1 from public.invites where code = v_code);
  end loop;
  return v_code;
end;
$$;

-- ═════════════════════════ 5. Lectura del panel ═════════════════════════

create or replace function public.panel_tutor()
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_uid uuid := public.exigir_tutor();
  v_lic public.licenses := public.licencia_tutor(v_uid);
  v_vigente boolean := v_lic.id is not null and v_lic.status = 'active' and v_lic.expires_at > now();
begin
  return jsonb_build_object(
    'licencia', case when v_lic.id is null then null else jsonb_build_object(
      'id', v_lic.id,
      'plan', v_lic.plan,
      'cupos', v_lic.seats,
      'usados', (select count(*) from public.license_seats s where s.license_id = v_lic.id and s.released_at is null),
      'origen', v_lic.source,
      'vigente', v_vigente,
      'inicia', v_lic.starts_at,
      'vence', v_lic.expires_at,
      'renovacion_automatica', v_lic.source = 'stripe' and v_lic.stripe_subscription_id is not null
    ) end,
    'grupos', coalesce((
      select jsonb_agg(jsonb_build_object('id', g.id, 'nombre', g.name) order by lower(g.name))
      from public.tutor_groups g where g.owner_id = v_uid
    ), '[]'::jsonb),
    'estudiantes', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id,
        'alias', p.alias,
        'nombre', p.full_name,
        'grupo_id', t.group_id,
        'vinculado', t.linked_at,
        'universidad_id', g.university_id,
        'carrera_id', g.career_id,
        'carrera', c.nombre,
        'universidad', i.clave,
        -- Activo = ocupa un lugar vigente de una licencia de este tutor.
        'activo', exists (
          select 1 from public.license_seats s join public.licenses l on l.id = s.license_id
          where s.student_id = p.id and s.released_at is null and l.owner_id = v_uid
            and l.status = 'active' and l.expires_at > now()
        )
      ) order by lower(p.alias))
      from public.tutor_students t
      join public.profiles p on p.id = t.student_id
      left join lateral (
        select sg.university_id, sg.career_id from public.student_goals sg
        where sg.user_id = p.id order by sg.is_initial desc, sg.created_at limit 1
      ) g on true
      left join public.carreras c on c.id = g.career_id
      left join public.instituciones i on i.id = c.institucion_id
      where t.owner_id = v_uid
    ), '[]'::jsonb)
  );
end;
$$;

-- Exámenes congelados de los estudiantes vinculados (null = todos). Sin preguntas ni respuestas.
create or replace function public.estadisticas_tutor(p_estudiantes uuid[] default null)
returns table (
  id bigint,
  student_id uuid,
  folio text,
  exam_type text,
  university_key text,
  career_name text,
  level text,
  total_questions integer,
  answered_questions integer,
  score_achieved numeric,
  max_score numeric,
  time_spent_seconds integer,
  completed_at timestamptz,
  resumen_por_materia jsonb
)
language sql stable security definer set search_path = ''
as $$
  select e.id, e.student_id, e.folio, e.exam_type, e.university_key, e.career_name, e.level,
         e.total_questions, e.answered_questions, e.score_achieved, e.max_score, e.time_spent_seconds,
         e.completed_at, coalesce(e.frozen_exam_data->'resumen_por_materia', '[]'::jsonb)
  from public.exam_history e
  join public.tutor_students t on t.student_id = e.student_id and t.owner_id = public.exigir_tutor()
  where p_estudiantes is null or e.student_id = any (p_estudiantes)
  order by e.completed_at;
$$;

-- ═════════════════════════ 6. Invitación ═════════════════════════

-- El enlace de la licencia vigente del tutor. p_nuevo = true invalida el anterior y genera otro.
create or replace function public.invitacion_tutor(p_nuevo boolean default false)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := public.exigir_tutor();
  v_lic public.licenses := public.licencia_tutor(v_uid);
  v_license uuid;
  v_code text;
begin
  v_license := case when v_lic.status = 'active' and v_lic.expires_at > now() then v_lic.id end;

  if p_nuevo then
    update public.invites set expires_at = now()
    where parent_id = v_uid and reusable and expires_at > now();
  else
    select code into v_code from public.invites
    where parent_id = v_uid and reusable and expires_at > now() and license_id is not distinct from v_license
    order by created_at desc limit 1;
    if v_code is not null then
      return v_code;
    end if;
  end if;

  v_code := public.nuevo_codigo_invitacion();
  insert into public.invites (code, parent_id, license_id, reusable, expires_at)
  values (v_code, v_uid, v_license, true,
          case when v_license is not null then least(v_lic.expires_at, now() + interval '90 days')
               else now() + interval '90 days' end);
  return v_code;
end;
$$;

-- ═════════════════════════ 7. Grupos ═════════════════════════

create or replace function public.crear_grupo_tutor(p_nombre text)
returns bigint
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := public.exigir_tutor();
  v_id bigint;
begin
  if (select count(*) from public.tutor_groups where owner_id = v_uid) >= 100 then
    raise exception 'Llegaste al máximo de 100 grupos.' using errcode = '22023';
  end if;
  insert into public.tutor_groups (owner_id, name) values (v_uid, trim(p_nombre)) returning id into v_id;
  return v_id;
exception when unique_violation then
  raise exception 'Ya tienes un grupo con ese nombre.' using errcode = '23505';
end;
$$;

create or replace function public.renombrar_grupo_tutor(p_grupo bigint, p_nombre text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := public.exigir_tutor();
begin
  update public.tutor_groups set name = trim(p_nombre) where id = p_grupo and owner_id = v_uid;
  if not found then
    raise exception 'Grupo no encontrado.' using errcode = 'P0002';
  end if;
exception when unique_violation then
  raise exception 'Ya tienes un grupo con ese nombre.' using errcode = '23505';
end;
$$;

-- Borrar un grupo no desvincula a nadie: sus estudiantes quedan "Sin grupo".
create or replace function public.borrar_grupo_tutor(p_grupo bigint)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := public.exigir_tutor();
begin
  delete from public.tutor_groups where id = p_grupo and owner_id = v_uid;
end;
$$;

-- p_grupo null = "Sin grupo".
create or replace function public.asignar_grupo_tutor(p_estudiante uuid, p_grupo bigint)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := public.exigir_tutor();
begin
  perform public.exigir_estudiante_del_tutor(v_uid, p_estudiante);
  update public.tutor_students set group_id = p_grupo where owner_id = v_uid and student_id = p_estudiante;
end;
$$;

-- ═════════════════════════ 8. Cupos ═════════════════════════

-- Ocupa un cupo libre de la licencia vigente con este estudiante.
create or replace function public.activar_lugar_tutor(p_estudiante uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := public.exigir_tutor();
  v_lic public.licenses := public.licencia_tutor(v_uid);
begin
  perform public.exigir_estudiante_del_tutor(v_uid, p_estudiante);
  if v_lic.id is null or v_lic.status <> 'active' or v_lic.expires_at <= now() then
    raise exception 'Tu suscripción no está activa.' using errcode = 'P0402';
  end if;
  if (select count(*) from public.license_seats where license_id = v_lic.id and released_at is null) >= v_lic.seats then
    raise exception 'Ya usaste todos tus cupos. Libera uno o amplía tu plan.' using errcode = 'P0001';
  end if;
  if not public.assign_seat(v_lic.id, p_estudiante) then
    raise exception 'Este estudiante ya tiene un acceso activo con otra licencia.' using errcode = 'P0001';
  end if;
end;
$$;

-- Libera el cupo que el estudiante ocupa en cualquier licencia de este tutor (queda vinculado, inactivo).
create or replace function public.liberar_lugar_tutor(p_estudiante uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := public.exigir_tutor();
begin
  perform public.exigir_estudiante_del_tutor(v_uid, p_estudiante);
  update public.license_seats s set released_at = now()
  from public.licenses l
  where s.license_id = l.id and l.owner_id = v_uid and s.student_id = p_estudiante and s.released_at is null;
end;
$$;

-- Quita al estudiante del panel: libera su cupo y borra el vínculo. Su historial sigue siendo suyo.
create or replace function public.desvincular_estudiante_tutor(p_estudiante uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := public.exigir_tutor();
begin
  perform public.liberar_lugar_tutor(p_estudiante);
  delete from public.tutor_students where owner_id = v_uid and student_id = p_estudiante;
end;
$$;

-- ═════════════════════════ 9. Permisos ═════════════════════════

revoke execute on function public.tutor_students_grupo_propio() from public, anon, authenticated;
revoke execute on function public.exigir_tutor() from public, anon, authenticated;
revoke execute on function public.licencia_tutor(uuid) from public, anon, authenticated;
revoke execute on function public.exigir_estudiante_del_tutor(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.nuevo_codigo_invitacion() from public, anon, authenticated;

revoke execute on function public.panel_tutor() from public, anon;
revoke execute on function public.estadisticas_tutor(uuid[]) from public, anon;
revoke execute on function public.invitacion_tutor(boolean) from public, anon;
revoke execute on function public.crear_grupo_tutor(text) from public, anon;
revoke execute on function public.renombrar_grupo_tutor(bigint, text) from public, anon;
revoke execute on function public.borrar_grupo_tutor(bigint) from public, anon;
revoke execute on function public.asignar_grupo_tutor(uuid, bigint) from public, anon;
revoke execute on function public.activar_lugar_tutor(uuid) from public, anon;
revoke execute on function public.liberar_lugar_tutor(uuid) from public, anon;
revoke execute on function public.desvincular_estudiante_tutor(uuid) from public, anon;

grant execute on function public.panel_tutor() to authenticated;
grant execute on function public.estadisticas_tutor(uuid[]) to authenticated;
grant execute on function public.invitacion_tutor(boolean) to authenticated;
grant execute on function public.crear_grupo_tutor(text) to authenticated;
grant execute on function public.renombrar_grupo_tutor(bigint, text) to authenticated;
grant execute on function public.borrar_grupo_tutor(bigint) to authenticated;
grant execute on function public.asignar_grupo_tutor(uuid, bigint) to authenticated;
grant execute on function public.activar_lugar_tutor(uuid) to authenticated;
grant execute on function public.liberar_lugar_tutor(uuid) to authenticated;
grant execute on function public.desvincular_estudiante_tutor(uuid) to authenticated;

commit;
