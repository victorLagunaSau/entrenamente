-- Entrena Mente · Autenticación, perfiles, metas e invitaciones.
-- Pegar completo en Supabase → SQL Editor → Run (una sola vez).

-- ───────────────────────── Tipos ─────────────────────────
create type public.user_type as enum ('student', 'parent', 'teacher');
create type public.payment_status as enum ('paid', 'unpaid', 'free_trial');
create type public.access_origin as enum ('free_trial', 'stripe_subscription', 'admin_grant', 'parent_invite');

-- ───────────────────────── Tablas ─────────────────────────
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  alias text,
  email text not null,
  user_type public.user_type not null default 'student',
  is_admin boolean not null default false,
  payment_status public.payment_status not null default 'free_trial',
  access_origin public.access_origin not null default 'free_trial',
  license_coupon_code text,
  granted_for_free_reason text,
  authorized_by uuid references public.profiles(id) on delete set null,
  license_expiration_date timestamptz,
  origin_school text,
  not_studying boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Metas del estudiante (escuela + carrera). Los ids vienen del catálogo del front.
create table public.student_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  university_id text not null,
  career_id text not null,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_id, university_id, career_id)
);
create unique index student_goals_one_primary on public.student_goals (user_id) where is_primary;

-- Invitaciones que un padre/tutor genera para su hijo/a.
create table public.invites (
  code text primary key check (code ~ '^[A-HJ-NP-Z2-9]{8}$'),
  parent_id uuid not null references public.profiles(id) on delete cascade,
  university_id text not null,
  career_id text not null,
  redeemed_by uuid references public.profiles(id) on delete set null,
  redeemed_at timestamptz,
  created_at timestamptz not null default now()
);
create index invites_parent_idx on public.invites (parent_id);

-- ───────────────────────── RLS ─────────────────────────
alter table public.profiles enable row level security;
alter table public.student_goals enable row level security;
alter table public.invites enable row level security;

create policy "profiles: ver el propio" on public.profiles
  for select to authenticated using ((select auth.uid()) = id);
create policy "profiles: editar el propio" on public.profiles
  for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

-- Desde el cliente solo se editan datos personales; pagos, licencias e is_admin quedan fuera.
revoke insert, update, delete on public.profiles from anon, authenticated;
grant update (full_name, alias, origin_school, not_studying) on public.profiles to authenticated;

create policy "goals: ver las propias" on public.student_goals
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "goals: agregar propias" on public.student_goals
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "goals: editar propias" on public.student_goals
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "goals: borrar propias" on public.student_goals
  for delete to authenticated using ((select auth.uid()) = user_id);

-- Las invitaciones solo las crea/canjea el trigger de registro.
create policy "invites: el padre ve las suyas" on public.invites
  for select to authenticated using ((select auth.uid()) = parent_id);
revoke insert, update, delete on public.invites from anon, authenticated;

-- ───────────────────────── RPC públicas ─────────────────────────
create or replace function public.is_email_available(p_email text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select not exists (select 1 from auth.users where lower(email) = lower(trim(p_email)));
$$;

-- Datos mínimos para mostrar una invitación antes de registrarse.
create or replace function public.get_invite(p_code text)
returns table (code text, parent_name text, university_id text, career_id text)
language sql stable security definer set search_path = ''
as $$
  select i.code, p.full_name, i.university_id, i.career_id
  from public.invites i
  join public.profiles p on p.id = i.parent_id
  where i.code = upper(trim(p_code)) and i.redeemed_by is null;
$$;

grant execute on function public.is_email_available(text) to anon, authenticated;
grant execute on function public.get_invite(text) to anon, authenticated;

-- ───────────────────────── Alta automática ─────────────────────────
-- Se ejecuta al crear cualquier usuario (correo o Google). Lee los datos del wizard
-- desde raw_user_meta_data y valida la invitación aquí, no en el navegador.
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_type public.user_type := case when meta->>'user_type' = 'parent' then 'parent' else 'student' end;
  v_university text := nullif(meta->>'university_id', '');
  v_career text := nullif(meta->>'career_id', '');
  v_invite public.invites;
begin
  if v_type = 'student' and nullif(meta->>'invite_code', '') is not null then
    select * into v_invite from public.invites
    where code = upper(meta->>'invite_code') and redeemed_by is null
    for update;
  end if;

  insert into public.profiles (
    id, email, full_name, alias, user_type, origin_school, not_studying,
    payment_status, access_origin, authorized_by
  ) values (
    new.id,
    coalesce(new.email, ''),
    coalesce(nullif(trim(meta->>'full_name'), ''), meta->>'name', ''),
    nullif(trim(meta->>'alias'), ''),
    v_type,
    nullif(trim(meta->>'origin_school'), ''),
    coalesce(meta->>'not_studying', 'false') = 'true',
    case when v_invite.code is not null then 'paid' else 'free_trial' end::public.payment_status,
    case when v_invite.code is not null then 'parent_invite' else 'free_trial' end::public.access_origin,
    v_invite.parent_id
  );

  if v_invite.code is not null then
    update public.invites set redeemed_by = new.id, redeemed_at = now() where code = v_invite.code;
    v_university := v_invite.university_id;
    v_career := v_invite.career_id;
  end if;

  if v_type = 'student' and v_university is not null and v_career is not null then
    insert into public.student_goals (user_id, university_id, career_id, is_primary)
    values (new.id, v_university, v_career, true);
  end if;

  -- El padre genera el código en el cliente para mostrarlo sin sesión (antes de confirmar su correo).
  if v_type = 'parent' and v_university is not null and v_career is not null
     and nullif(meta->>'new_invite_code', '') is not null then
    insert into public.invites (code, parent_id, university_id, career_id)
    values (upper(meta->>'new_invite_code'), new.id, v_university, v_career);
  end if;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.touch_updated_at()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_touch
  before update on public.profiles
  for each row execute function public.touch_updated_at();
