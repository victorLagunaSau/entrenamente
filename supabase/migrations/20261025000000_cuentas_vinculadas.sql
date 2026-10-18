-- Cuentas vinculadas: el estudiante con tutor no compra; le pide a su tutor activar o renovar el plan.
-- · tutor_requests: solicitudes del estudiante (aviso en el panel del tutor + correo desde /api/tutor/solicitud).
-- · mis_tutores(): a quién está vinculado el estudiante y si alguno le patrocina el acceso.
-- · solicitar_plan_tutor(): registra la solicitud (máximo una por tutor cada 12 horas).
-- · solicitudes_tutor() / atender_solicitudes_tutor(): el tutor ve y descarta las solicitudes.
-- · desvincular_mi_tutor(): el estudiante se desvincula (libera el cupo; su cuenta vuelve a Demo).
-- Sin cambios en Stripe ni en las licencias: la facturación sigue en la cuenta del tutor.

begin;

create table public.tutor_requests (
  id bigint generated always as identity primary key,
  student_id uuid not null references public.profiles(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  emailed_at timestamptz,
  seen_at timestamptz
);
create index tutor_requests_owner_idx on public.tutor_requests (owner_id) where seen_at is null;
create index tutor_requests_student_idx on public.tutor_requests (student_id, owner_id, created_at desc);

-- Solo se usa por funciones.
alter table public.tutor_requests enable row level security;
revoke all on public.tutor_requests from public, anon, authenticated;

-- ═════════════════════════ Estudiante ═════════════════════════

create or replace function public.mis_tutores()
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', p.id,
    'nombre', coalesce(nullif(trim(p.full_name), ''), p.alias),
    'tipo', p.user_type,
    'vinculado', t.linked_at,
    -- Le patrocina un cupo vigente ahora mismo.
    'patrocina', exists (
      select 1 from public.license_seats s
      join public.licenses l on l.id = s.license_id
      where s.student_id = t.student_id and s.released_at is null
        and l.owner_id = t.owner_id and l.status = 'active' and l.expires_at > now()
    ),
    'ultima_solicitud', (
      select max(r.created_at) from public.tutor_requests r
      where r.student_id = t.student_id and r.owner_id = t.owner_id
    )
  ) order by t.linked_at), '[]'::jsonb)
  from public.tutor_students t
  join public.profiles p on p.id = t.owner_id
  where t.student_id = (select auth.uid());
$$;

create or replace function public.solicitar_plan_tutor()
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_ids bigint[];
begin
  if v_uid is null then
    raise exception 'Inicia sesión.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.tutor_students where student_id = v_uid) then
    raise exception 'Tu cuenta no está vinculada a un tutor.' using errcode = 'P0001';
  end if;

  with nuevas as (
    insert into public.tutor_requests (student_id, owner_id)
    select v_uid, t.owner_id
    from public.tutor_students t
    where t.student_id = v_uid
      and not exists (
        select 1 from public.tutor_requests r
        where r.student_id = v_uid and r.owner_id = t.owner_id and r.created_at > now() - interval '12 hours'
      )
    returning id
  )
  select array_agg(id) into v_ids from nuevas;

  if v_ids is null then
    raise exception 'Ya le avisaste a tu tutor hace poco. Podrás volver a pedírselo en unas horas.' using errcode = 'P0001';
  end if;
  return jsonb_build_object('ids', to_jsonb(v_ids));
end;
$$;

create or replace function public.desvincular_mi_tutor(p_tutor uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'Inicia sesión.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.tutor_students where owner_id = p_tutor and student_id = v_uid) then
    raise exception 'Tu cuenta no está vinculada a ese tutor.' using errcode = 'P0001';
  end if;
  -- Pierde el cupo que le daba ese tutor (el tutor lo recupera).
  update public.license_seats s set released_at = now()
  from public.licenses l
  where s.license_id = l.id and l.owner_id = p_tutor and s.student_id = v_uid and s.released_at is null;
  delete from public.tutor_students where owner_id = p_tutor and student_id = v_uid;
  update public.tutor_requests set seen_at = now() where owner_id = p_tutor and student_id = v_uid and seen_at is null;
end;
$$;

-- ═════════════════════════ Tutor ═════════════════════════

create or replace function public.solicitudes_tutor()
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', r.id,
    'estudiante', r.student_id,
    'alias', p.alias,
    'nombre', coalesce(nullif(trim(p.full_name), ''), p.alias),
    'fecha', r.created_at
  ) order by r.created_at desc), '[]'::jsonb)
  from public.tutor_requests r
  join public.profiles p on p.id = r.student_id
  where r.owner_id = public.exigir_tutor() and r.seen_at is null
    and exists (select 1 from public.tutor_students t where t.owner_id = r.owner_id and t.student_id = r.student_id);
$$;

create or replace function public.atender_solicitudes_tutor(p_ids bigint[])
returns void
language sql security definer set search_path = ''
as $$
  update public.tutor_requests set seen_at = now()
  where owner_id = public.exigir_tutor() and id = any(p_ids) and seen_at is null;
$$;

-- ═════════════════════════ Correo (servidor, clave secreta) ═════════════════════════

-- /api/tutor/solicitud: datos para el correo de las solicitudes recién creadas por el estudiante; las marca enviadas.
create or replace function public.correo_solicitudes_tutor(p_estudiante uuid, p_ids bigint[])
returns jsonb
language sql security definer set search_path = ''
as $$
  with marcadas as (
    update public.tutor_requests r set emailed_at = now()
    where r.student_id = p_estudiante and r.id = any(p_ids) and r.emailed_at is null
      and r.created_at > now() - interval '10 minutes'
    returning r.owner_id
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'email', u.email,
    'tutor', coalesce(nullif(trim(o.full_name), ''), o.alias),
    'estudiante', (select coalesce(nullif(trim(s.full_name), ''), s.alias) from public.profiles s where s.id = p_estudiante)
  )), '[]'::jsonb)
  from marcadas m
  join public.profiles o on o.id = m.owner_id
  join auth.users u on u.id = m.owner_id
  where u.email is not null;
$$;

revoke execute on function public.mis_tutores() from public, anon;
revoke execute on function public.solicitar_plan_tutor() from public, anon;
revoke execute on function public.desvincular_mi_tutor(uuid) from public, anon;
revoke execute on function public.solicitudes_tutor() from public, anon;
revoke execute on function public.atender_solicitudes_tutor(bigint[]) from public, anon;
revoke execute on function public.correo_solicitudes_tutor(uuid, bigint[]) from public, anon, authenticated;

grant execute on function public.mis_tutores() to authenticated;
grant execute on function public.solicitar_plan_tutor() to authenticated;
grant execute on function public.desvincular_mi_tutor(uuid) to authenticated;
grant execute on function public.solicitudes_tutor() to authenticated;
grant execute on function public.atender_solicitudes_tutor(bigint[]) to authenticated;
grant execute on function public.correo_solicitudes_tutor(uuid, bigint[]) to service_role;

commit;
