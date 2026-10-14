-- Entrena Mente · Motor de planes, A/B testing persistente, ofertas flash, recibos y analítica de conversión.
--
-- Se corre DESPUÉS de 20261017000000_saludo_neutro.sql.
-- Pegar completo en Supabase → SQL Editor → Run. Todo va en una transacción: si algo falla, no cambia nada.
--
-- Qué agrega:
--   · profiles.assigned_pricing_variant / variant_assigned_at: la variante A/B del usuario, de por vida.
--     El cliente NO puede editarla; solo `asignar_variante_precio()` la fija, una sola vez.
--   · subscription_plans: catálogo de planes por rol (Estudiante, Tutor, Dúo, Familia) editable por el admin.
--   · ab_experiments: qué ofertas ve cada variante (máximo un experimento activo por rol).
--   · flash_sales: ofertas temporales; nunca tocan la variante asignada.
--   · pricing_analytics_events: embudo impresión → intención → registro → recibo.
--   · receipts: recibos con vigencia; cada recibo crea su licencia (vía admin_otorgar_licencia).
--   · Trigger de registro: graba la variante del visitante anónimo (metadatos del signUp) y el evento de registro.
--   · RPCs públicas: get_pricing_catalog, registrar_evento_precio, asignar_variante_precio.
--   · RPCs admin_*: precios, experimentos, ofertas, recibos y métricas.

begin;

-- ═════════════════════════ 1. Variante A/B en el perfil ═════════════════════════

alter table public.profiles
  add column assigned_pricing_variant varchar(20) default null
    check (assigned_pricing_variant in ('variant_a', 'variant_b')),
  add column variant_assigned_at timestamptz default null;
-- Sin grant de update: el cliente no puede cambiarla (solo las funciones de abajo).

-- ═════════════════════════ 2. Tipos ═════════════════════════

create type public.user_target_role as enum ('student', 'parent', 'teacher', 'institution');
create type public.billing_interval as enum ('monthly', 'quarterly', 'annual', 'one_time');
create type public.analytics_event_type as enum ('impression', 'click_intent', 'conversion_registered', 'receipt_issued');

-- ═════════════════════════ 3. Catálogo de planes ═════════════════════════

create table public.subscription_plans (
  id varchar(50) primary key check (id ~ '^[a-z0-9_]+$'),
  target_role public.user_target_role not null,
  name varchar(100) not null,
  description text,
  base_price_monthly numeric(10,2) not null check (base_price_monthly >= 0),
  base_price_annual numeric(10,2) null check (base_price_annual >= 0),
  features jsonb not null default '[]'::jsonb check (jsonb_typeof(features) = 'array'),
  min_students int not null default 1 check (min_students >= 1),
  max_students int not null default 1,
  extra_student_price_monthly numeric(10,2) not null default 0.00 check (extra_student_price_monthly >= 0),
  badge varchar(40),                      -- Ej. 'Plan más popular'
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (max_students >= min_students)
);

create trigger subscription_plans_touch before update on public.subscription_plans
  for each row execute function public.touch_updated_at();

-- ═════════════════════════ 4. Experimentos A/B y ofertas flash ═════════════════════════

-- Config de cada variante: { "offers": [ { "plan_id": "student", "interval": "monthly", "price": 89 }, … ] }
create table public.ab_experiments (
  id uuid primary key default gen_random_uuid(),
  experiment_name varchar(100) not null,
  target_role public.user_target_role not null default 'student',
  variant_a_config jsonb not null,
  variant_b_config jsonb not null,
  status varchar(20) not null default 'active' check (status in ('active', 'paused', 'finished')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- Un solo experimento activo por rol (el que ve la página de planes).
create unique index ab_experiments_one_active on public.ab_experiments (target_role) where status = 'active';

create trigger ab_experiments_touch before update on public.ab_experiments
  for each row execute function public.touch_updated_at();

create table public.flash_sales (
  id uuid primary key default gen_random_uuid(),
  title varchar(100) not null,
  target_role public.user_target_role not null,
  plan_id varchar(50) not null references public.subscription_plans(id) on update cascade,
  billing_cycle public.billing_interval not null default 'monthly',
  discounted_price numeric(10,2) not null check (discounted_price >= 0),
  duration_days int not null check (duration_days > 0),   -- días de licencia que da la compra en oferta
  starts_at timestamptz not null,
  expires_at timestamptz not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  check (expires_at > starts_at)
);
create index flash_sales_window_idx on public.flash_sales (target_role, starts_at, expires_at) where is_active;

-- ═════════════════════════ 5. Analítica de conversión ═════════════════════════

create table public.pricing_analytics_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,   -- null = visitante anónimo
  visitor_id varchar(64),                                            -- id anónimo del navegador
  experiment_id uuid references public.ab_experiments(id) on delete set null,
  assigned_variant varchar(20) not null check (assigned_variant in ('variant_a', 'variant_b')),
  event_type public.analytics_event_type not null,
  target_role public.user_target_role,
  plan_selected_id varchar(50),
  billing_cycle public.billing_interval,
  source varchar(30),                                                -- landing, pricing, home-demo, billing…
  device_type varchar(20) check (device_type in ('mobile', 'desktop')),
  created_at timestamptz not null default now()
);
create index pricing_events_experiment_idx on public.pricing_analytics_events (experiment_id, assigned_variant, event_type);
create index pricing_events_visitor_idx on public.pricing_analytics_events (visitor_id) where visitor_id is not null;
create index pricing_events_user_idx on public.pricing_analytics_events (user_id) where user_id is not null;

-- ═════════════════════════ 6. Recibos ═════════════════════════

create sequence public.receipt_code_seq;

create table public.receipts (
  id uuid primary key default gen_random_uuid(),
  receipt_code varchar(50) unique not null
    default 'REC-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.receipt_code_seq')::text, 6, '0'),
  user_id uuid not null references public.profiles(id) on delete cascade,
  plan_id varchar(50) not null,
  license_id uuid references public.licenses(id) on delete set null,
  experiment_id uuid references public.ab_experiments(id) on delete set null,
  flash_sale_id uuid references public.flash_sales(id) on delete set null,
  assigned_variant varchar(20),
  seats int not null default 1 check (seats >= 1),
  amount_paid numeric(10,2) not null check (amount_paid >= 0),
  currency varchar(10) not null default 'MXN',
  billing_cycle public.billing_interval not null,
  duration_days int not null check (duration_days > 0),
  license_starts_at timestamptz not null default now(),
  license_expires_at timestamptz not null,
  status varchar(20) not null default 'active' check (status in ('active', 'expired', 'refunded')),
  notes text,
  issued_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (license_expires_at > license_starts_at)
);
create index receipts_user_idx on public.receipts (user_id);

create trigger receipts_touch before update on public.receipts
  for each row execute function public.touch_updated_at();

-- ═════════════════════════ 7. RLS ═════════════════════════

alter table public.subscription_plans enable row level security;
alter table public.ab_experiments enable row level security;
alter table public.flash_sales enable row level security;
alter table public.pricing_analytics_events enable row level security;
alter table public.receipts enable row level security;

-- Todo pasa por funciones; el usuario solo puede leer sus propios recibos.
create policy "receipts: ver los propios" on public.receipts
  for select to authenticated using ((select auth.uid()) = user_id);

revoke all on public.subscription_plans, public.ab_experiments, public.flash_sales,
  public.pricing_analytics_events from anon, authenticated;
revoke insert, update, delete on public.receipts from anon, authenticated;
grant select on public.receipts to authenticated;

-- ═════════════════════════ 8. Datos iniciales ═════════════════════════

insert into public.subscription_plans
  (id, target_role, name, description, base_price_monthly, base_price_annual, features,
   min_students, max_students, extra_student_price_monthly, badge, sort_order)
values
  ('student', 'student', 'Plan Estudiante', 'Entrena sin límites hasta el día de tu examen.', 89, 750,
   '["Exámenes ilimitados en todas tus carreras", "Modo Racha: mini-exámenes diarios de 10 minutos",
     "Plan de estudio con la fecha real de tu examen", "Guía de errores: cómo resolver cada pregunta que fallaste",
     "Agrega más de una carrera o universidad", "Estadísticas por examen y de tu avance general",
     "Reporte de cada examen con solución paso a paso, en PDF",
     "Simulacros con el tiempo y la apariencia de tu examen real"]'::jsonb,
   1, 1, 0, null, 1),
  ('tutor', 'parent', 'Plan Tutor', 'Acceso ilimitado para tu estudiante y tú lo acompañas en su preparación.', 120, 1152,
   '["Acceso ilimitado para 1 estudiante: Plan, Examen Libre y Modo Racha",
     "Panel para monitorear su avance, materia por materia", "Reportes para WhatsApp y en PDF"]'::jsonb,
   1, 1, 0, 'Plan más popular', 1),
  ('duo', 'parent', 'Plan Dúo', 'Extiende el acceso ilimitado a 2 estudiantes y dales seguimiento en un solo panel.', 170, 1632,
   '["Acceso ilimitado para 2 estudiantes", "Monitoreo de ambos en un solo panel",
     "Comparativa entre estudiantes y reportes"]'::jsonb,
   2, 2, 0, null, 2),
  ('familia', 'parent', 'Plan Familia', 'De 3 estudiantes en adelante: tú decides cuántos, al mejor precio por estudiante.', 225, 2160,
   '["Acceso ilimitado para los estudiantes que elijas", "Grupos para organizarlos (hijos, primos, sobrinos…)",
     "Estadísticas por estudiante y por grupo"]'::jsonb,
   3, 30, 75, null, 3);

insert into public.ab_experiments (experiment_name, target_role, variant_a_config, variant_b_config)
values (
  'Estudiantes: Mensual vs Trimestral',
  'student',
  '{"offers": [{"plan_id": "student", "interval": "monthly", "price": 89},
               {"plan_id": "student", "interval": "annual", "price": 750}]}'::jsonb,
  '{"offers": [{"plan_id": "student", "interval": "quarterly", "price": 250},
               {"plan_id": "student", "interval": "annual", "price": 750}]}'::jsonb
);

-- ═════════════════════════ 9. Funciones auxiliares ═════════════════════════

create or replace function public.variante_valida(p text)
returns text
language sql immutable set search_path = ''
as $$ select case when p in ('variant_a', 'variant_b') then p end $$;

create or replace function public.variante_aleatoria()
returns text
language sql volatile set search_path = ''
as $$ select case when random() < 0.5 then 'variant_a' else 'variant_b' end $$;

-- Rol comercial de un tipo de usuario (los tutores, maestros y directores compran planes de padres por ahora).
create or replace function public.rol_de_precio(p_user_type text)
returns public.user_target_role
language sql immutable set search_path = ''
as $$ select case when p_user_type in ('student') then 'student' else 'parent' end::public.user_target_role $$;

create or replace function public.experimento_activo(p_role public.user_target_role)
returns uuid
language sql stable security definer set search_path = ''
as $$ select id from public.ab_experiments where target_role = p_role and status = 'active' limit 1 $$;

-- Días de licencia por ciclo de cobro.
create or replace function public.dias_de_ciclo(p_ciclo public.billing_interval)
returns integer
language sql immutable set search_path = ''
as $$
  select case p_ciclo when 'monthly' then 30 when 'quarterly' then 90 when 'annual' then 365 else 30 end
$$;

-- ═════════════════════════ 10. Funciones públicas ═════════════════════════

-- Catálogo para /pricing, la landing y los homes: planes activos, experimentos activos y ofertas vigentes.
create or replace function public.get_pricing_catalog()
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'plans', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id, 'target_role', p.target_role, 'name', p.name, 'description', p.description,
        'base_price_monthly', p.base_price_monthly, 'base_price_annual', p.base_price_annual,
        'features', p.features, 'min_students', p.min_students, 'max_students', p.max_students,
        'extra_student_price_monthly', p.extra_student_price_monthly, 'badge', p.badge
      ) order by p.target_role, p.sort_order, p.id)
      from public.subscription_plans p where p.is_active), '[]'::jsonb),
    'experiments', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', e.id, 'name', e.experiment_name, 'target_role', e.target_role,
        'variant_a', e.variant_a_config, 'variant_b', e.variant_b_config))
      from public.ab_experiments e where e.status = 'active'), '[]'::jsonb),
    'flash_sales', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', f.id, 'title', f.title, 'target_role', f.target_role, 'plan_id', f.plan_id,
        'billing_cycle', f.billing_cycle, 'discounted_price', f.discounted_price,
        'duration_days', f.duration_days, 'starts_at', f.starts_at, 'expires_at', f.expires_at
      ) order by f.expires_at)
      from public.flash_sales f
      join public.subscription_plans p on p.id = f.plan_id and p.is_active
      where f.is_active and f.starts_at <= now() and now() <= f.expires_at), '[]'::jsonb)
  )
$$;

-- Fija la variante del usuario en sesión UNA sola vez y la regresa. Si ya tenía, se ignora p_variant.
-- p_variant: la del navegador (localStorage) para conservar la que vio como visitante; inválida/nula → 50/50.
-- Si es su primera asignación, la cuenta es reciente y venía de un clic de compra, registra la conversión
-- (cubre el alta con Google, que no manda metadatos de registro).
create or replace function public.asignar_variante_precio(
  p_variant text default null,
  p_visitor text default null,
  p_intent_plan text default null,
  p_device text default null
)
returns text
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_profile public.profiles;
  v_variant text;
  v_role public.user_target_role;
begin
  if v_uid is null then
    raise exception 'Inicia sesión.' using errcode = '42501';
  end if;
  select * into v_profile from public.profiles where id = v_uid for update;
  if not found then
    raise exception 'Perfil no encontrado.' using errcode = 'P0002';
  end if;
  if v_profile.assigned_pricing_variant is not null then
    return v_profile.assigned_pricing_variant;
  end if;

  v_variant := coalesce(public.variante_valida(p_variant), public.variante_aleatoria());
  update public.profiles set assigned_pricing_variant = v_variant, variant_assigned_at = now() where id = v_uid;

  -- Los eventos anónimos de este navegador pasan a ser del usuario.
  if nullif(trim(p_visitor), '') is not null then
    update public.pricing_analytics_events set user_id = v_uid
    where visitor_id = left(trim(p_visitor), 64) and user_id is null;
  end if;

  v_role := public.rol_de_precio(v_profile.user_type);
  if nullif(trim(p_intent_plan), '') is not null
     and v_profile.created_at > now() - interval '2 days'
     and not exists (select 1 from public.pricing_analytics_events
                     where user_id = v_uid and event_type = 'conversion_registered') then
    insert into public.pricing_analytics_events
      (user_id, visitor_id, experiment_id, assigned_variant, event_type, target_role, plan_selected_id, source, device_type)
    values (v_uid, left(nullif(trim(p_visitor), ''), 64), public.experimento_activo(v_role), v_variant,
            'conversion_registered', v_role, left(trim(p_intent_plan), 50), 'registro',
            case when p_device in ('mobile', 'desktop') then p_device end);
  end if;

  return v_variant;
end;
$$;

-- Impresiones e intenciones de compra (visitantes y usuarios). Con sesión manda la variante del perfil.
create or replace function public.registrar_evento_precio(
  p_event text,
  p_variant text,
  p_role text,
  p_plan text default null,
  p_cycle text default null,
  p_device text default null,
  p_visitor text default null,
  p_source text default null
)
returns void
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_variant text;
  v_role public.user_target_role;
begin
  if p_event not in ('impression', 'click_intent') then
    raise exception 'Evento no permitido.' using errcode = '22023';
  end if;
  if p_role not in ('student', 'parent') then
    raise exception 'Rol no válido.' using errcode = '22023';
  end if;
  v_role := p_role::public.user_target_role;

  if v_uid is not null then
    select assigned_pricing_variant into v_variant from public.profiles where id = v_uid;
  end if;
  v_variant := coalesce(v_variant, public.variante_valida(p_variant));
  if v_variant is null then
    raise exception 'Variante no válida.' using errcode = '22023';
  end if;

  insert into public.pricing_analytics_events
    (user_id, visitor_id, experiment_id, assigned_variant, event_type, target_role, plan_selected_id,
     billing_cycle, source, device_type)
  values (
    v_uid,
    left(nullif(trim(p_visitor), ''), 64),
    public.experimento_activo(v_role),
    v_variant,
    p_event::public.analytics_event_type,
    v_role,
    left(nullif(trim(p_plan), ''), 50),
    case when p_cycle in ('monthly', 'quarterly', 'annual', 'one_time') then p_cycle::public.billing_interval end,
    left(nullif(trim(p_source), ''), 30),
    case when p_device in ('mobile', 'desktop') then p_device end
  );
end;
$$;

-- Al registrarse: graba la variante que traía el visitante (metadatos del signUp) y el evento de registro.
-- Corre después de on_auth_user_created (los triggers van en orden alfabético), así que el perfil ya existe.
-- Nunca debe tumbar un registro: cualquier error se ignora.
create or replace function public.vincular_variante_registro()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_variant text := public.variante_valida(meta->>'pricing_variant');
  v_visitor text := left(nullif(trim(meta->>'pricing_visitor_id'), ''), 64);
  v_intent text := left(nullif(trim(meta->>'pricing_intent_plan'), ''), 50);
  v_type text;
  v_role public.user_target_role;
begin
  if v_variant is null then
    return new;
  end if;
  begin
    update public.profiles
    set assigned_pricing_variant = v_variant, variant_assigned_at = now()
    where id = new.id and assigned_pricing_variant is null
    returning user_type into v_type;
    if not found then
      return new;
    end if;

    if v_visitor is not null then
      update public.pricing_analytics_events set user_id = new.id where visitor_id = v_visitor and user_id is null;
    end if;

    if v_intent is not null then
      v_role := public.rol_de_precio(v_type);
      insert into public.pricing_analytics_events
        (user_id, visitor_id, experiment_id, assigned_variant, event_type, target_role, plan_selected_id, source, device_type)
      values (new.id, v_visitor, public.experimento_activo(v_role), v_variant, 'conversion_registered', v_role,
              v_intent, 'registro',
              case when meta->>'pricing_device' in ('mobile', 'desktop') then meta->>'pricing_device' end);
    end if;
  exception when others then
    raise warning 'vincular_variante_registro: %', sqlerrm;
  end;
  return new;
end;
$$;

create trigger on_auth_user_pricing
  after insert on auth.users
  for each row execute function public.vincular_variante_registro();

-- ═════════════════════════ 11. Admin: planes, experimentos y ofertas ═════════════════════════

create or replace function public.admin_precios()
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform public.exigir_admin();
  return jsonb_build_object(
    'plans', coalesce((select jsonb_agg(to_jsonb(p) order by p.target_role, p.sort_order, p.id)
                       from public.subscription_plans p), '[]'::jsonb),
    'experiments', coalesce((select jsonb_agg(to_jsonb(e) order by (e.status = 'active') desc, e.created_at desc)
                             from public.ab_experiments e), '[]'::jsonb),
    'flash_sales', coalesce((select jsonb_agg(to_jsonb(f) order by f.starts_at desc)
                             from public.flash_sales f), '[]'::jsonb)
  );
end;
$$;

create or replace function public.admin_guardar_plan(
  p_id text,
  p_name text,
  p_description text,
  p_monthly numeric,
  p_annual numeric,
  p_extra numeric,
  p_features jsonb,
  p_badge text,
  p_active boolean
)
returns void
language plpgsql volatile security definer set search_path = ''
as $$
begin
  perform public.exigir_admin();
  if nullif(trim(p_name), '') is null then
    raise exception 'El plan necesita un nombre.' using errcode = '22023';
  end if;
  if coalesce(p_monthly, -1) < 0 or coalesce(p_annual, 0) < 0 or coalesce(p_extra, 0) < 0 then
    raise exception 'Los precios no pueden ser negativos.' using errcode = '22023';
  end if;
  update public.subscription_plans
  set name = trim(p_name),
      description = nullif(trim(p_description), ''),
      base_price_monthly = p_monthly,
      base_price_annual = p_annual,
      extra_student_price_monthly = coalesce(p_extra, 0),
      features = coalesce(p_features, '[]'::jsonb),
      badge = nullif(trim(p_badge), ''),
      is_active = coalesce(p_active, true)
  where id = p_id;
  if not found then
    raise exception 'Ese plan no existe.' using errcode = 'P0002';
  end if;
end;
$$;

-- Valida la config de una variante: { "offers": [ { plan_id, interval, price } ] } con planes del rol.
create or replace function public.validar_config_variante(p_config jsonb, p_role public.user_target_role)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  o jsonb;
begin
  if jsonb_typeof(p_config->'offers') <> 'array' or jsonb_array_length(p_config->'offers') = 0 then
    raise exception 'Cada variante necesita al menos una oferta.' using errcode = '22023';
  end if;
  for o in select * from jsonb_array_elements(p_config->'offers') loop
    if not exists (select 1 from public.subscription_plans where id = o->>'plan_id' and target_role = p_role) then
      raise exception 'El plan % no es del rol %.', o->>'plan_id', p_role using errcode = '22023';
    end if;
    if o->>'interval' not in ('monthly', 'quarterly', 'annual', 'one_time') then
      raise exception 'Periodo no válido: %.', o->>'interval' using errcode = '22023';
    end if;
    if jsonb_typeof(o->'price') <> 'number' or (o->>'price')::numeric < 0 then
      raise exception 'Precio no válido en la oferta %.', o->>'plan_id' using errcode = '22023';
    end if;
  end loop;
  return p_config;
end;
$$;

-- Crea (p_id null) o edita un experimento. Uno nuevo nace pausado para no romper el que corre.
create or replace function public.admin_guardar_experimento(
  p_id uuid,
  p_name text,
  p_role text,
  p_a jsonb,
  p_b jsonb
)
returns uuid
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_role public.user_target_role := p_role::public.user_target_role;
  v_id uuid;
begin
  perform public.exigir_admin();
  if nullif(trim(p_name), '') is null then
    raise exception 'El experimento necesita un nombre.' using errcode = '22023';
  end if;
  perform public.validar_config_variante(p_a, v_role);
  perform public.validar_config_variante(p_b, v_role);

  if p_id is null then
    insert into public.ab_experiments (experiment_name, target_role, variant_a_config, variant_b_config, status)
    values (trim(p_name), v_role, p_a, p_b, 'paused')
    returning id into v_id;
  else
    update public.ab_experiments
    set experiment_name = trim(p_name), variant_a_config = p_a, variant_b_config = p_b
    where id = p_id and target_role = v_role
    returning id into v_id;
    if v_id is null then
      raise exception 'Ese experimento no existe.' using errcode = 'P0002';
    end if;
  end if;
  return v_id;
end;
$$;

-- Activar uno pausa el que estuviera activo para el mismo rol.
create or replace function public.admin_estado_experimento(p_id uuid, p_status text)
returns void
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_role public.user_target_role;
begin
  perform public.exigir_admin();
  if p_status not in ('active', 'paused', 'finished') then
    raise exception 'Estado no válido.' using errcode = '22023';
  end if;
  select target_role into v_role from public.ab_experiments where id = p_id;
  if not found then
    raise exception 'Ese experimento no existe.' using errcode = 'P0002';
  end if;
  if p_status = 'active' then
    update public.ab_experiments set status = 'paused' where target_role = v_role and status = 'active' and id <> p_id;
  end if;
  update public.ab_experiments set status = p_status where id = p_id;
end;
$$;

create or replace function public.admin_guardar_oferta(
  p_id uuid,
  p_title text,
  p_plan text,
  p_cycle text,
  p_price numeric,
  p_duration_days integer,
  p_starts_at timestamptz,
  p_expires_at timestamptz,
  p_active boolean
)
returns uuid
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_role public.user_target_role;
  v_id uuid;
begin
  perform public.exigir_admin();
  select target_role into v_role from public.subscription_plans where id = p_plan;
  if not found then
    raise exception 'Elige un plan.' using errcode = '22023';
  end if;
  if nullif(trim(p_title), '') is null then
    raise exception 'La oferta necesita un título.' using errcode = '22023';
  end if;
  if coalesce(p_price, -1) < 0 then
    raise exception 'Escribe el precio de la oferta.' using errcode = '22023';
  end if;
  if coalesce(p_duration_days, 0) < 1 then
    raise exception 'La licencia de la oferta debe durar al menos 1 día.' using errcode = '22023';
  end if;
  if p_starts_at is null or p_expires_at is null or p_expires_at <= p_starts_at then
    raise exception 'La fecha de cierre debe ser posterior a la de inicio.' using errcode = '22023';
  end if;

  if p_id is null then
    insert into public.flash_sales
      (title, target_role, plan_id, billing_cycle, discounted_price, duration_days, starts_at, expires_at, is_active)
    values (trim(p_title), v_role, p_plan, p_cycle::public.billing_interval, p_price, p_duration_days,
            p_starts_at, p_expires_at, coalesce(p_active, true))
    returning id into v_id;
  else
    update public.flash_sales
    set title = trim(p_title), target_role = v_role, plan_id = p_plan, billing_cycle = p_cycle::public.billing_interval,
        discounted_price = p_price, duration_days = p_duration_days, starts_at = p_starts_at,
        expires_at = p_expires_at, is_active = coalesce(p_active, true)
    where id = p_id
    returning id into v_id;
    if v_id is null then
      raise exception 'Esa oferta no existe.' using errcode = 'P0002';
    end if;
  end if;
  return v_id;
end;
$$;

create or replace function public.admin_estado_oferta(p_id uuid, p_active boolean)
returns void
language plpgsql volatile security definer set search_path = ''
as $$
begin
  perform public.exigir_admin();
  update public.flash_sales set is_active = p_active where id = p_id;
  if not found then
    raise exception 'Esa oferta no existe.' using errcode = 'P0002';
  end if;
end;
$$;

-- ═════════════════════════ 12. Admin: recibos ═════════════════════════

create or replace function public.admin_recibo_json(r public.receipts)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select to_jsonb(r) || jsonb_build_object(
    'user', (select jsonb_build_object('id', p.id, 'alias', p.alias, 'email', p.email, 'full_name', p.full_name,
                                       'user_type', p.user_type)
             from public.profiles p where p.id = r.user_id),
    'plan_name', (select name from public.subscription_plans where id = r.plan_id),
    'vigente', r.status = 'active' and r.license_expires_at > now()
  )
$$;

-- Emite un recibo (compra simulada o, a futuro, confirmada por la pasarela) y crea su licencia.
-- p_monto null = precio que le toca: oferta flash indicada, su variante del experimento activo o el precio base.
create or replace function public.admin_emitir_recibo(
  p_user uuid,
  p_plan text,
  p_ciclo text,
  p_estudiantes integer default null,
  p_monto numeric default null,
  p_oferta uuid default null,
  p_notas text default null
)
returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_admin uuid := public.exigir_admin();
  v_profile public.profiles;
  v_plan public.subscription_plans;
  v_ciclo public.billing_interval := p_ciclo::public.billing_interval;
  v_role public.user_target_role;
  v_variant text;
  v_experiment uuid;
  v_offer jsonb;
  v_sale public.flash_sales;
  v_seats integer;
  v_monto numeric;
  v_dias integer;
  v_license_plan text;
  v_code text;
  v_license uuid;
  v_receipt public.receipts;
begin
  select * into v_profile from public.profiles where id = p_user;
  if not found then
    raise exception 'Ese usuario ya no existe.' using errcode = 'P0002';
  end if;
  select * into v_plan from public.subscription_plans where id = p_plan;
  if not found then
    raise exception 'Ese plan no existe.' using errcode = 'P0002';
  end if;
  v_role := public.rol_de_precio(v_profile.user_type);
  if v_plan.target_role <> v_role then
    raise exception 'El % no corresponde a este tipo de usuario.', v_plan.name using errcode = '22023';
  end if;

  v_seats := greatest(v_plan.min_students, least(coalesce(p_estudiantes, v_plan.min_students), v_plan.max_students));

  -- La variante del usuario queda fija desde su primera compra si aún no tenía.
  v_variant := v_profile.assigned_pricing_variant;
  if v_variant is null then
    v_variant := public.variante_aleatoria();
    update public.profiles set assigned_pricing_variant = v_variant, variant_assigned_at = now() where id = p_user;
  end if;
  v_experiment := public.experimento_activo(v_role);

  if p_oferta is not null then
    select * into v_sale from public.flash_sales where id = p_oferta;
    if not found or v_sale.plan_id <> p_plan then
      raise exception 'La oferta no corresponde a ese plan.' using errcode = '22023';
    end if;
    v_ciclo := v_sale.billing_cycle;
    v_dias := v_sale.duration_days;
    v_monto := v_sale.discounted_price;
  else
    v_dias := public.dias_de_ciclo(v_ciclo);
    select o.value into v_offer
    from public.ab_experiments e,
         jsonb_array_elements(case when v_variant = 'variant_b' then e.variant_b_config else e.variant_a_config end->'offers') o
    where e.id = v_experiment and o.value->>'plan_id' = p_plan and o.value->>'interval' = v_ciclo::text
    limit 1;
    v_monto := case
      when v_offer is not null then (v_offer->>'price')::numeric
      when v_ciclo = 'annual' then coalesce(v_plan.base_price_annual, v_plan.base_price_monthly * 12)
      when v_ciclo = 'quarterly' then v_plan.base_price_monthly * 3
      else v_plan.base_price_monthly
    end;
    -- Plan Familia: estudiantes extra sobre el mínimo, con el mismo descuento del ciclo.
    if v_seats > v_plan.min_students and v_plan.extra_student_price_monthly > 0 then
      v_monto := v_monto + (v_seats - v_plan.min_students) * v_plan.extra_student_price_monthly
        * case v_ciclo when 'annual' then 12 * coalesce(v_plan.base_price_annual / nullif(v_plan.base_price_monthly * 12, 0), 1)
                       when 'quarterly' then 3 else 1 end;
    end if;
  end if;
  v_monto := round(coalesce(p_monto, v_monto), 2);

  v_license_plan := case when p_plan in ('duo') then 'family_2' when p_plan in ('familia') then 'family_5' else 'individual' end;
  v_code := 'REC-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.receipt_code_seq')::text, 6, '0');
  v_license := public.admin_otorgar_licencia(p_user, v_license_plan, v_seats, v_dias, 'Recibo ' || v_code);

  insert into public.receipts
    (receipt_code, user_id, plan_id, license_id, experiment_id, flash_sale_id, assigned_variant, seats, amount_paid,
     billing_cycle, duration_days, license_starts_at, license_expires_at, notes, issued_by)
  values
    (v_code, p_user, p_plan, v_license, v_experiment, p_oferta, v_variant, v_seats, v_monto,
     v_ciclo, v_dias, now(), now() + make_interval(days => v_dias), nullif(trim(p_notas), ''), v_admin)
  returning * into v_receipt;

  insert into public.pricing_analytics_events
    (user_id, experiment_id, assigned_variant, event_type, target_role, plan_selected_id, billing_cycle, source)
  values (p_user, v_experiment, v_variant, 'receipt_issued', v_role, p_plan, v_ciclo, 'admin');

  return public.admin_recibo_json(v_receipt);
end;
$$;

-- Búsqueda al enviar: por correo, apodo, nombre o código. Vacío = los 50 más recientes.
create or replace function public.admin_buscar_recibos(p_q text)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_q text := nullif(trim(p_q), '');
begin
  perform public.exigir_admin();
  return coalesce((
    select jsonb_agg(public.admin_recibo_json(r) order by r.created_at desc)
    from (
      select r.*
      from public.receipts r
      join public.profiles p on p.id = r.user_id
      where v_q is null
         or r.receipt_code ilike '%' || v_q || '%'
         or p.email ilike '%' || v_q || '%'
         or p.alias ilike '%' || v_q || '%'
         or p.full_name ilike '%' || v_q || '%'
      order by r.created_at desc
      limit 50
    ) r
  ), '[]'::jsonb);
end;
$$;

-- Suma (o resta) días al recibo y a su licencia.
create or replace function public.admin_extender_recibo(p_id uuid, p_dias integer)
returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_receipt public.receipts;
begin
  perform public.exigir_admin();
  if coalesce(p_dias, 0) = 0 then
    raise exception 'Escribe cuántos días.' using errcode = '22023';
  end if;
  update public.receipts
  set duration_days = duration_days + p_dias,
      license_expires_at = license_expires_at + make_interval(days => p_dias),
      status = case when status = 'expired' and license_expires_at + make_interval(days => p_dias) > now()
                    then 'active' else status end
  where id = p_id
  returning * into v_receipt;
  if v_receipt.id is null then
    raise exception 'Ese recibo no existe.' using errcode = 'P0002';
  end if;
  if v_receipt.duration_days < 1 then
    raise exception 'La licencia quedaría sin días.' using errcode = '22023';
  end if;
  update public.licenses set expires_at = v_receipt.license_expires_at where id = v_receipt.license_id;
  return public.admin_recibo_json(v_receipt);
end;
$$;

-- Desactivar (refunded) apaga la licencia; reactivar (active) la vuelve a encender.
create or replace function public.admin_estado_recibo(p_id uuid, p_status text)
returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_receipt public.receipts;
begin
  perform public.exigir_admin();
  if p_status not in ('active', 'refunded') then
    raise exception 'Estado no válido.' using errcode = '22023';
  end if;
  update public.receipts set status = p_status where id = p_id returning * into v_receipt;
  if v_receipt.id is null then
    raise exception 'Ese recibo no existe.' using errcode = 'P0002';
  end if;
  update public.licenses
  set status = case when p_status = 'active' then 'active' else 'inactive' end
  where id = v_receipt.license_id;
  return public.admin_recibo_json(v_receipt);
end;
$$;

-- ═════════════════════════ 13. Admin: métricas del embudo ═════════════════════════

-- Embudo por variante de un experimento (null = el activo de estudiantes, o el más reciente).
create or replace function public.admin_metricas_ab(p_experiment uuid default null)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_exp public.ab_experiments;
begin
  perform public.exigir_admin();
  if p_experiment is null then
    select * into v_exp from public.ab_experiments
    order by (status = 'active' and target_role = 'student') desc, created_at desc limit 1;
  else
    select * into v_exp from public.ab_experiments where id = p_experiment;
  end if;
  if v_exp.id is null then
    return jsonb_build_object('experiment', null, 'variants', '[]'::jsonb);
  end if;

  return jsonb_build_object(
    'experiment', to_jsonb(v_exp),
    'variants', (
      select jsonb_agg(jsonb_build_object(
        'variant', v.variant,
        'impressions', (select count(*) from public.pricing_analytics_events e
                        where e.experiment_id = v_exp.id and e.assigned_variant = v.variant and e.event_type = 'impression'),
        'visitors', (select count(distinct coalesce(e.user_id::text, e.visitor_id)) from public.pricing_analytics_events e
                     where e.experiment_id = v_exp.id and e.assigned_variant = v.variant and e.event_type = 'impression'),
        'click_intents', (select count(*) from public.pricing_analytics_events e
                          where e.experiment_id = v_exp.id and e.assigned_variant = v.variant and e.event_type = 'click_intent'),
        'registrations', (select count(*) from public.pricing_analytics_events e
                          where e.experiment_id = v_exp.id and e.assigned_variant = v.variant
                            and e.event_type = 'conversion_registered'),
        'receipts', (select count(*) from public.receipts r
                     where r.experiment_id = v_exp.id and r.assigned_variant = v.variant and r.status <> 'refunded'),
        'revenue', (select coalesce(sum(r.amount_paid), 0) from public.receipts r
                    where r.experiment_id = v_exp.id and r.assigned_variant = v.variant and r.status <> 'refunded'),
        'by_plan', coalesce((
          select jsonb_object_agg(k, n) from (
            select coalesce(e.plan_selected_id, '?') || ':' || coalesce(e.billing_cycle::text, '?') as k, count(*) as n
            from public.pricing_analytics_events e
            where e.experiment_id = v_exp.id and e.assigned_variant = v.variant and e.event_type = 'click_intent'
            group by 1) x), '{}'::jsonb),
        'mobile_share', (select round(avg(case when e.device_type = 'mobile' then 1 else 0 end)::numeric, 3)
                         from public.pricing_analytics_events e
                         where e.experiment_id = v_exp.id and e.assigned_variant = v.variant and e.event_type = 'impression')
      ) order by v.variant)
      from (values ('variant_a'), ('variant_b')) v(variant)
    ),
    'assigned', jsonb_build_object(
      'variant_a', (select count(*) from public.profiles where assigned_pricing_variant = 'variant_a'),
      'variant_b', (select count(*) from public.profiles where assigned_pricing_variant = 'variant_b')
    )
  );
end;
$$;

-- ═════════════════════════ 14. Permisos ═════════════════════════

revoke execute on function public.variante_valida(text) from public, anon, authenticated;
revoke execute on function public.variante_aleatoria() from public, anon, authenticated;
revoke execute on function public.rol_de_precio(text) from public, anon, authenticated;
revoke execute on function public.experimento_activo(public.user_target_role) from public, anon, authenticated;
revoke execute on function public.dias_de_ciclo(public.billing_interval) from public, anon, authenticated;
revoke execute on function public.vincular_variante_registro() from public, anon, authenticated;
revoke execute on function public.validar_config_variante(jsonb, public.user_target_role) from public, anon, authenticated;
revoke execute on function public.admin_recibo_json(public.receipts) from public, anon, authenticated;

grant execute on function public.get_pricing_catalog() to anon, authenticated;
grant execute on function public.registrar_evento_precio(text, text, text, text, text, text, text, text) to anon, authenticated;
revoke execute on function public.asignar_variante_precio(text, text, text, text) from public, anon;
grant execute on function public.asignar_variante_precio(text, text, text, text) to authenticated;

revoke execute on function public.admin_precios() from public, anon;
revoke execute on function public.admin_guardar_plan(text, text, text, numeric, numeric, numeric, jsonb, text, boolean) from public, anon;
revoke execute on function public.admin_guardar_experimento(uuid, text, text, jsonb, jsonb) from public, anon;
revoke execute on function public.admin_estado_experimento(uuid, text) from public, anon;
revoke execute on function public.admin_guardar_oferta(uuid, text, text, text, numeric, integer, timestamptz, timestamptz, boolean) from public, anon;
revoke execute on function public.admin_estado_oferta(uuid, boolean) from public, anon;
revoke execute on function public.admin_emitir_recibo(uuid, text, text, integer, numeric, uuid, text) from public, anon;
revoke execute on function public.admin_buscar_recibos(text) from public, anon;
revoke execute on function public.admin_extender_recibo(uuid, integer) from public, anon;
revoke execute on function public.admin_estado_recibo(uuid, text) from public, anon;
revoke execute on function public.admin_metricas_ab(uuid) from public, anon;
grant execute on function public.admin_precios() to authenticated;
grant execute on function public.admin_guardar_plan(text, text, text, numeric, numeric, numeric, jsonb, text, boolean) to authenticated;
grant execute on function public.admin_guardar_experimento(uuid, text, text, jsonb, jsonb) to authenticated;
grant execute on function public.admin_estado_experimento(uuid, text) to authenticated;
grant execute on function public.admin_guardar_oferta(uuid, text, text, text, numeric, integer, timestamptz, timestamptz, boolean) to authenticated;
grant execute on function public.admin_estado_oferta(uuid, boolean) to authenticated;
grant execute on function public.admin_emitir_recibo(uuid, text, text, integer, numeric, uuid, text) to authenticated;
grant execute on function public.admin_buscar_recibos(text) to authenticated;
grant execute on function public.admin_extender_recibo(uuid, integer) to authenticated;
grant execute on function public.admin_estado_recibo(uuid, text) to authenticated;
grant execute on function public.admin_metricas_ab(uuid) to authenticated;

commit;
