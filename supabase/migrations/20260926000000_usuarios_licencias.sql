-- Entrena Mente · Modelo "Spotify Familiar": las personas son permanentes, las licencias temporales.
--
-- Se corre DESPUÉS de 20260925000000_auth_profiles.sql (ya aplicada).
-- Pegar completo en Supabase → SQL Editor → Run. Todo va en una transacción: si algo falla, no cambia nada.
--
-- Qué cambia:
--   · profiles queda como perfil base (sin datos de pago). Roles: student, parent, teacher, director, admin.
--   · Apodo nunca vacío: si no lo escriben, se usa el primer nombre.
--   · Aviso de privacidad: fecha y versión aceptadas.
--   · student_profiles: datos exclusivos del estudiante (escuela de procedencia, "no estudio", pruebas gratis usadas).
--   · student_goals: la meta del registro es la "inicial" (gratis); agregar más será de pago.
--   · licenses: el "contrato" (lo compra/obtiene quien paga: estudiante, padre, maestro o escuela).
--   · license_seats: qué estudiante ocupa cada lugar de una licencia (la "Asignación").
--   · coupons: listos para el futuro; un cupón crea una licencia igual que un pago.
--   · invites: ahora pueden ligarse a una licencia y vencen.
--   · get_my_access(): el "interruptor" del estudiante (active / free / inactive).

begin;

-- ═════════════════════════ 1. Perfil base (profiles) ═════════════════════════

-- Roles como texto + CHECK: agregar un rol nuevo no obliga a recrear tipos.
alter table public.profiles alter column user_type drop default;
alter table public.profiles alter column user_type type text using user_type::text;
alter table public.profiles alter column user_type set default 'student';
alter table public.profiles add constraint profiles_user_type_check
  check (user_type in ('student', 'parent', 'teacher', 'director', 'admin'));

update public.profiles set user_type = 'admin' where is_admin;

-- Apodo automático para los perfiles que ya existen.
update public.profiles
set alias = coalesce(nullif(split_part(trim(full_name), ' ', 1), ''), split_part(email, '@', 1))
where nullif(trim(alias), '') is null;
alter table public.profiles alter column alias set not null;
alter table public.profiles add constraint profiles_alias_not_blank check (length(trim(alias)) > 0);

alter table public.profiles
  add column avatar_url text,
  add column privacy_accepted_at timestamptz,
  add column privacy_version text;

-- ═════════════════════════ 2. Perfil del estudiante ═════════════════════════

create table public.student_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  origin_school text,
  not_studying boolean not null default false,
  -- Contador del motor de exámenes (lo incrementa el servidor, nunca el cliente).
  free_exams_used integer not null default 0 check (free_exams_used >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.student_profiles (user_id, origin_school, not_studying)
select id, origin_school, not_studying from public.profiles where user_type = 'student';

-- ═════════════════════════ 3. Metas académicas ═════════════════════════

alter table public.student_goals rename column is_primary to is_initial;
alter index public.student_goals_one_primary rename to student_goals_one_initial;

-- ═════════════════════════ 4. Cupones, licencias y lugares ═════════════════════════

create table public.coupons (
  code text primary key check (code = upper(code) and length(code) between 4 and 32),
  plan text not null check (plan in ('individual', 'family_2', 'family_5', 'school', 'promo')),
  seats integer not null default 1 check (seats between 1 and 10000),
  duration_days integer not null check (duration_days > 0),
  max_redemptions integer check (max_redemptions > 0), -- null = sin límite
  redemptions integer not null default 0 check (redemptions >= 0),
  valid_until timestamptz,                             -- último día para canjearlo
  active boolean not null default true,
  reason text not null,                                -- "Gratis por:"
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.licenses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade, -- quien paga / canjea
  plan text not null check (plan in ('individual', 'family_2', 'family_5', 'school', 'promo')),
  seats integer not null check (seats between 1 and 10000),
  source text not null check (source in ('stripe', 'coupon', 'admin')),
  status text not null default 'active' check (status in ('active', 'inactive')),
  starts_at timestamptz not null default now(),
  expires_at timestamptz not null,
  coupon_code text references public.coupons(code) on delete set null,
  granted_reason text,                                                    -- "Gratis por:"
  authorized_by uuid references public.profiles(id) on delete set null,   -- "Autorizado por:"
  stripe_customer_id text,
  stripe_subscription_id text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (expires_at > starts_at),
  check (source <> 'admin' or (granted_reason is not null and authorized_by is not null))
);
create index licenses_owner_idx on public.licenses (owner_id);

-- La "Asignación": qué estudiante ocupa un lugar. Liberar un lugar no borra el historial.
create table public.license_seats (
  id uuid primary key default gen_random_uuid(),
  license_id uuid not null references public.licenses(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  assigned_at timestamptz not null default now(),
  released_at timestamptz,
  check (released_at is null or released_at >= assigned_at)
);
-- Un estudiante ocupa como máximo un lugar vigente a la vez.
create unique index license_seats_one_active_per_student on public.license_seats (student_id) where released_at is null;
create index license_seats_license_idx on public.license_seats (license_id) where released_at is null;

-- ═════════════════════════ 5. Invitaciones ═════════════════════════

alter table public.invites
  add column license_id uuid references public.licenses(id) on delete set null,
  add column expires_at timestamptz not null default now() + interval '30 days';

-- ═════════════════════════ 6. Quitar del perfil lo que ya vive en otras tablas ═════════════════════════

-- Los datos de pago pasan a licenses; los académicos a student_profiles.
alter table public.profiles
  drop column is_admin,
  drop column payment_status,
  drop column access_origin,
  drop column license_coupon_code,
  drop column granted_for_free_reason,
  drop column authorized_by,
  drop column license_expiration_date,
  drop column origin_school,
  drop column not_studying;

drop type public.user_type;
drop type public.payment_status;
drop type public.access_origin;

-- ═════════════════════════ 7. Funciones auxiliares ═════════════════════════

create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.profiles where id = (select auth.uid()) and user_type = 'admin');
$$;

-- Evitan recursión entre las políticas de licenses y license_seats.
create or replace function public.owns_license(p_license uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.licenses where id = p_license and owner_id = (select auth.uid()));
$$;

create or replace function public.holds_seat(p_license uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.license_seats
    where license_id = p_license and student_id = (select auth.uid()) and released_at is null
  );
$$;

-- ¿El usuario actual patrocina (paga una licencia vigente) a este estudiante? Da acceso a su monitoreo.
create or replace function public.is_sponsor_of(p_student uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.license_seats s
    join public.licenses l on l.id = s.license_id
    where s.student_id = p_student and s.released_at is null
      and l.owner_id = (select auth.uid()) and l.owner_id <> p_student
      and l.status = 'active' and l.expires_at > now()
  );
$$;

-- Pruebas gratis del plan inicial. Cambiar aquí el número.
create or replace function public.free_exam_limit()
returns integer
language sql immutable set search_path = ''
as $$ select 3 $$;

-- Ocupa un lugar libre de una licencia vigente. Libera antes un lugar anterior que ya no da acceso.
-- Solo la usan el trigger de registro, redeem_coupon y (a futuro) el webhook de Stripe.
create or replace function public.assign_seat(p_license uuid, p_student uuid)
returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  v_license public.licenses;
  v_used integer;
begin
  select * into v_license from public.licenses where id = p_license for update;
  if not found or v_license.status <> 'active' or v_license.expires_at <= now() then
    return false;
  end if;

  select count(*) into v_used from public.license_seats where license_id = p_license and released_at is null;
  if v_used >= v_license.seats then
    return false;
  end if;

  update public.license_seats s set released_at = now()
  from public.licenses l
  where s.license_id = l.id and s.student_id = p_student and s.released_at is null
    and (l.status <> 'active' or l.expires_at <= now());

  if exists (select 1 from public.license_seats where student_id = p_student and released_at is null) then
    return false; -- ya tiene un acceso vigente
  end if;

  insert into public.license_seats (license_id, student_id) values (p_license, p_student);
  return true;
end;
$$;

-- El "interruptor" del estudiante:
--   active   → licencia vigente (propia, de su padre/escuela, cupón) o administrador
--   free     → plan inicial gratis con pruebas disponibles
--   inactive → sin licencia y sin pruebas gratis
create or replace function public.get_my_access()
returns table (
  status text,
  source text,
  plan text,
  expires_at timestamptz,
  sponsor_alias text,
  free_exams_left integer
)
language sql stable security definer set search_path = ''
as $$
  with me as (
    select p.id, p.user_type from public.profiles p where p.id = (select auth.uid())
  ),
  lic as (
    select l.source, l.plan, l.expires_at,
           case when l.owner_id <> s.student_id then o.alias end as sponsor_alias
    from public.license_seats s
    join public.licenses l on l.id = s.license_id
    join public.profiles o on o.id = l.owner_id
    where s.student_id = (select auth.uid()) and s.released_at is null
      and l.status = 'active' and l.expires_at > now()
    limit 1
  ),
  sp as (
    select free_exams_used from public.student_profiles where user_id = (select auth.uid())
  )
  select
    case
      when me.user_type = 'admin' then 'active'
      when lic.source is not null then 'active'
      when coalesce(sp.free_exams_used, 0) < public.free_exam_limit() then 'free'
      else 'inactive'
    end,
    case when me.user_type = 'admin' then 'admin' else lic.source end,
    lic.plan,
    lic.expires_at,
    lic.sponsor_alias,
    greatest(public.free_exam_limit() - coalesce(sp.free_exams_used, 0), 0)
  from me
  left join lic on true
  left join sp on true;
$$;

-- Canje de cupón: crea una licencia igual que un pago (Stripe usará el mismo camino con source = 'stripe').
create or replace function public.redeem_coupon(p_code text)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_coupon public.coupons;
  v_license uuid;
  v_is_student boolean;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  select * into v_coupon from public.coupons where code = upper(trim(p_code)) for update;
  if not found or not v_coupon.active
     or (v_coupon.valid_until is not null and v_coupon.valid_until < now())
     or (v_coupon.max_redemptions is not null and v_coupon.redemptions >= v_coupon.max_redemptions) then
    raise exception 'coupon_invalid' using errcode = 'P0001';
  end if;

  if exists (select 1 from public.licenses where owner_id = v_uid and coupon_code = v_coupon.code) then
    raise exception 'coupon_already_used' using errcode = 'P0001';
  end if;

  select user_type = 'student' into v_is_student from public.profiles where id = v_uid;
  if v_is_student and exists (
    select 1 from public.license_seats s join public.licenses l on l.id = s.license_id
    where s.student_id = v_uid and s.released_at is null and l.status = 'active' and l.expires_at > now()
  ) then
    raise exception 'already_active' using errcode = 'P0001';
  end if;

  insert into public.licenses (owner_id, plan, seats, source, expires_at, coupon_code, granted_reason, authorized_by)
  values (v_uid, v_coupon.plan, v_coupon.seats, 'coupon',
          now() + make_interval(days => v_coupon.duration_days), v_coupon.code, v_coupon.reason, v_coupon.created_by)
  returning id into v_license;

  update public.coupons set redemptions = redemptions + 1 where code = v_coupon.code;

  -- El estudiante que canjea ocupa el primer lugar de su propia licencia.
  if v_is_student then
    perform public.assign_seat(v_license, v_uid);
  end if;

  return v_license;
end;
$$;

-- Invitación pública: ahora dice si trae un lugar pagado disponible y respeta el vencimiento.
drop function public.get_invite(text);
create function public.get_invite(p_code text)
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
  where i.code = upper(trim(p_code)) and i.redeemed_by is null and i.expires_at > now();
$$;

-- Permisos de ejecución: por defecto Postgres deja ejecutar funciones a todos.
revoke execute on function public.is_admin() from public, anon;
revoke execute on function public.owns_license(uuid) from public, anon;
revoke execute on function public.holds_seat(uuid) from public, anon;
revoke execute on function public.is_sponsor_of(uuid) from public, anon;
revoke execute on function public.assign_seat(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.get_my_access() from public, anon;
revoke execute on function public.redeem_coupon(text) from public, anon;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.owns_license(uuid) to authenticated;
grant execute on function public.holds_seat(uuid) to authenticated;
grant execute on function public.is_sponsor_of(uuid) to authenticated;
grant execute on function public.get_my_access() to authenticated;
grant execute on function public.redeem_coupon(text) to authenticated;
grant execute on function public.get_invite(text) to anon, authenticated;

-- ═════════════════════════ 8. Alta automática (reemplaza la anterior) ═════════════════════════

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
    where code = upper(meta->>'invite_code') and redeemed_by is null and expires_at > now()
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
    update public.invites set redeemed_by = new.id, redeemed_at = now() where code = v_invite.code;
    v_university := v_invite.university_id;
    v_career := v_invite.career_id;
    -- Enciende el interruptor solo si la licencia del padre tiene lugar libre.
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

-- ═════════════════════════ 9. Seguridad (RLS y permisos) ═════════════════════════

alter table public.student_profiles enable row level security;
alter table public.coupons enable row level security;
alter table public.licenses enable row level security;
alter table public.license_seats enable row level security;

-- profiles: el propio, el patrocinador (padre/maestro que paga) y el admin.
create policy "profiles: patrocinador ve a sus estudiantes" on public.profiles
  for select to authenticated using (public.is_sponsor_of(id));
create policy "profiles: admin ve todos" on public.profiles
  for select to authenticated using (public.is_admin());
grant update (avatar_url) on public.profiles to authenticated;

-- student_profiles: el estudiante edita sus datos; el contador de pruebas es solo del servidor.
create policy "student_profiles: ver el propio" on public.student_profiles
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "student_profiles: patrocinador" on public.student_profiles
  for select to authenticated using (public.is_sponsor_of(user_id));
create policy "student_profiles: admin" on public.student_profiles
  for select to authenticated using (public.is_admin());
create policy "student_profiles: editar el propio" on public.student_profiles
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
revoke insert, update, delete on public.student_profiles from anon, authenticated;
grant update (origin_school, not_studying) on public.student_profiles to authenticated;

-- student_goals: agregar/cambiar carreras será una función de pago; por ahora solo lectura.
drop policy "goals: agregar propias" on public.student_goals;
drop policy "goals: editar propias" on public.student_goals;
drop policy "goals: borrar propias" on public.student_goals;
revoke insert, update, delete on public.student_goals from anon, authenticated;
create policy "goals: patrocinador" on public.student_goals
  for select to authenticated using (public.is_sponsor_of(user_id));
create policy "goals: admin" on public.student_goals
  for select to authenticated using (public.is_admin());

-- licenses / license_seats: solo lectura para dueño, estudiante asignado y admin.
-- Se escriben únicamente desde funciones del servidor (cupón, Stripe, admin).
create policy "licenses: dueño" on public.licenses
  for select to authenticated using ((select auth.uid()) = owner_id);
create policy "licenses: estudiante asignado" on public.licenses
  for select to authenticated using (public.holds_seat(id));
create policy "licenses: admin" on public.licenses
  for select to authenticated using (public.is_admin());
revoke insert, update, delete on public.licenses from anon, authenticated;

create policy "seats: el estudiante" on public.license_seats
  for select to authenticated using ((select auth.uid()) = student_id);
create policy "seats: dueño de la licencia" on public.license_seats
  for select to authenticated using (public.owns_license(license_id));
create policy "seats: admin" on public.license_seats
  for select to authenticated using (public.is_admin());
revoke insert, update, delete on public.license_seats from anon, authenticated;

-- coupons: nadie los lee desde el cliente (se canjean con redeem_coupon); solo el admin.
create policy "coupons: admin" on public.coupons
  for select to authenticated using (public.is_admin());
revoke insert, update, delete on public.coupons from anon, authenticated;

create policy "invites: admin" on public.invites
  for select to authenticated using (public.is_admin());

-- updated_at automático.
create trigger student_profiles_touch
  before update on public.student_profiles
  for each row execute function public.touch_updated_at();
create trigger licenses_touch
  before update on public.licenses
  for each row execute function public.touch_updated_at();

commit;
