-- Entrena Mente · Lista de precios definitiva (la misma de Stripe) + ofertas por porcentaje.
--
-- Se corre DESPUÉS de 20261018000000_planes_ab_testing.sql (ya aplicada).
-- Pegar completo en Supabase → SQL Editor → Run. Todo va en una transacción: si algo falla, no cambia nada.
--
-- Qué cambia:
--   · Estudiantes: mensual $85, trimestral $219, anual $699.
--       Variante A = mensual + anual · Variante B = trimestral + anual (el experimento sigue igual, con precios nuevos).
--   · Padres: Tutor $105 / $879 · Dúo $169 / $1,399 · Familia de 3 a 6 estudiantes a $75 / $629 cada uno
--     (Familia 3 = $225 / $1,887 … Familia 6 = $450 / $3,774).
--   · flash_sales acepta ofertas por porcentaje para todos los planes de un rol (plan_id y precio vacíos).
--     El precio en oferta se redondea por unidad: round(precio × 0.6); en Familia, por estudiante × estudiantes.
--   · Oferta "40 % de descuento hasta el 20 de diciembre" para Estudiantes y para Padres, desde hoy.
--   · get_pricing_catalog, admin_guardar_oferta y admin_emitir_recibo se actualizan para lo anterior.

begin;

-- ═════════════════════════ 1. Precios ═════════════════════════

update public.subscription_plans set base_price_monthly = 85, base_price_annual = 699 where id = 'student';
update public.subscription_plans set base_price_monthly = 105, base_price_annual = 879 where id = 'tutor';
update public.subscription_plans set base_price_monthly = 169, base_price_annual = 1399 where id = 'duo';
-- Familia: precios base = 3 estudiantes; cada estudiante extra $75 al mes ($629 al año). Máximo 6.
update public.subscription_plans
set base_price_monthly = 225, base_price_annual = 1887, extra_student_price_monthly = 75,
    min_students = 3, max_students = 6,
    description = 'De 3 a 6 estudiantes: tú decides cuántos, al mejor precio por estudiante.'
where id = 'familia';

update public.ab_experiments
set variant_a_config = '{"offers": [{"plan_id": "student", "interval": "monthly", "price": 85},
                                    {"plan_id": "student", "interval": "annual", "price": 699}]}'::jsonb,
    variant_b_config = '{"offers": [{"plan_id": "student", "interval": "quarterly", "price": 219},
                                    {"plan_id": "student", "interval": "annual", "price": 699}]}'::jsonb
where experiment_name = 'Estudiantes: Mensual vs Trimestral';

-- ═════════════════════════ 2. Ofertas por porcentaje ═════════════════════════

alter table public.flash_sales
  alter column plan_id drop not null,
  alter column discounted_price drop not null,
  alter column duration_days drop not null,     -- null = los días del periodo que compre
  add column discount_pct numeric(5,2) check (discount_pct > 0 and discount_pct < 100);

-- Una oferta es de precio fijo (un plan y un periodo) o de porcentaje (un plan o todos los del rol).
alter table public.flash_sales add constraint flash_sales_tipo check (
  (discounted_price is not null and plan_id is not null and discount_pct is null)
  or (discount_pct is not null and discounted_price is null)
);

insert into public.flash_sales
  (title, target_role, plan_id, billing_cycle, discounted_price, discount_pct, duration_days, starts_at, expires_at)
values
  ('40 % de descuento hasta el 20 de diciembre', 'student', null, 'monthly', null, 40, null,
   now(), '2026-12-20 23:59:59 America/Mexico_City'),
  ('40 % de descuento hasta el 20 de diciembre', 'parent', null, 'monthly', null, 40, null,
   now(), '2026-12-20 23:59:59 America/Mexico_City');

-- Precio con descuento por porcentaje (redondeo a pesos, como en Stripe).
create or replace function public.precio_con_descuento(p_precio numeric, p_pct numeric)
returns numeric
language sql immutable set search_path = ''
as $$ select round(p_precio * (1 - p_pct / 100)) $$;

-- ═════════════════════════ 3. Catálogo público ═════════════════════════

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
        'billing_cycle', f.billing_cycle, 'discounted_price', f.discounted_price, 'discount_pct', f.discount_pct,
        'duration_days', f.duration_days, 'starts_at', f.starts_at, 'expires_at', f.expires_at
      ) order by f.expires_at)
      from public.flash_sales f
      left join public.subscription_plans p on p.id = f.plan_id
      where f.is_active and f.starts_at <= now() and now() <= f.expires_at
        and (f.plan_id is null or p.is_active)), '[]'::jsonb)
  )
$$;

-- ═════════════════════════ 4. Admin: ofertas ═════════════════════════

drop function public.admin_guardar_oferta(uuid, text, text, text, numeric, integer, timestamptz, timestamptz, boolean);

-- Precio fijo: p_plan + p_cycle + p_price. Porcentaje: p_pct (+ p_plan opcional; sin plan = todos los del rol).
create or replace function public.admin_guardar_oferta(
  p_id uuid,
  p_title text,
  p_role text,
  p_plan text,
  p_cycle text,
  p_price numeric,
  p_pct numeric,
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
  v_plan text := nullif(trim(p_plan), '');
  v_id uuid;
begin
  perform public.exigir_admin();
  if v_plan is not null then
    select target_role into v_role from public.subscription_plans where id = v_plan;
    if not found then
      raise exception 'Ese plan no existe.' using errcode = '22023';
    end if;
  elsif p_role in ('student', 'parent') then
    v_role := p_role::public.user_target_role;
  else
    raise exception 'Elige a quién aplica la oferta.' using errcode = '22023';
  end if;
  if nullif(trim(p_title), '') is null then
    raise exception 'La oferta necesita un título.' using errcode = '22023';
  end if;
  if p_pct is null and (v_plan is null or coalesce(p_price, -1) < 0) then
    raise exception 'Escribe el precio de la oferta o un porcentaje de descuento.' using errcode = '22023';
  end if;
  if p_pct is not null and (p_pct <= 0 or p_pct >= 100) then
    raise exception 'El descuento debe estar entre 1 y 99 %%.' using errcode = '22023';
  end if;
  if p_duration_days is not null and p_duration_days < 1 then
    raise exception 'La licencia de la oferta debe durar al menos 1 día.' using errcode = '22023';
  end if;
  if p_starts_at is null or p_expires_at is null or p_expires_at <= p_starts_at then
    raise exception 'La fecha de cierre debe ser posterior a la de inicio.' using errcode = '22023';
  end if;

  if p_id is null then
    insert into public.flash_sales
      (title, target_role, plan_id, billing_cycle, discounted_price, discount_pct, duration_days, starts_at, expires_at, is_active)
    values (trim(p_title), v_role, v_plan, coalesce(p_cycle, 'monthly')::public.billing_interval,
            case when p_pct is null then p_price end, p_pct, p_duration_days, p_starts_at, p_expires_at,
            coalesce(p_active, true))
    returning id into v_id;
  else
    update public.flash_sales
    set title = trim(p_title), target_role = v_role, plan_id = v_plan,
        billing_cycle = coalesce(p_cycle, 'monthly')::public.billing_interval,
        discounted_price = case when p_pct is null then p_price end, discount_pct = p_pct,
        duration_days = p_duration_days, starts_at = p_starts_at, expires_at = p_expires_at,
        is_active = coalesce(p_active, true)
    where id = p_id
    returning id into v_id;
    if v_id is null then
      raise exception 'Esa oferta no existe.' using errcode = 'P0002';
    end if;
  end if;
  return v_id;
end;
$$;

-- ═════════════════════════ 5. Admin: recibos con la lista nueva ═════════════════════════

-- Mismo contrato que antes. Precio normal: oferta de su variante (estudiantes) o el del plan; Familia por estudiante
-- ($75 al mes, base_annual / min_students al año). Con oferta: precio fijo o porcentaje redondeado por unidad.
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
  v_per_student boolean;
  v_seats integer;
  v_unit numeric;
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

  v_per_student := v_plan.max_students > v_plan.min_students and v_plan.extra_student_price_monthly > 0;
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
    if not found or v_sale.target_role <> v_role or (v_sale.plan_id is not null and v_sale.plan_id <> p_plan) then
      raise exception 'La oferta no corresponde a ese plan.' using errcode = '22023';
    end if;
    if v_sale.discount_pct is null then
      v_ciclo := v_sale.billing_cycle;   -- las de precio fijo son de un solo periodo
    end if;
  end if;

  -- Precio normal por unidad (por estudiante en Familia; el plan completo en los demás).
  if v_per_student then
    v_unit := case v_ciclo
      when 'annual' then coalesce(v_plan.base_price_annual, v_plan.base_price_monthly * 12) / v_plan.min_students
      when 'quarterly' then v_plan.extra_student_price_monthly * 3
      else v_plan.extra_student_price_monthly end;
  else
    select o.value into v_offer
    from public.ab_experiments e,
         jsonb_array_elements(case when v_variant = 'variant_b' then e.variant_b_config else e.variant_a_config end->'offers') o
    where e.id = v_experiment and o.value->>'plan_id' = p_plan and o.value->>'interval' = v_ciclo::text
    limit 1;
    v_unit := case
      when v_offer is not null then (v_offer->>'price')::numeric
      when v_ciclo = 'annual' then coalesce(v_plan.base_price_annual, v_plan.base_price_monthly * 12)
      when v_ciclo = 'quarterly' then v_plan.base_price_monthly * 3
      else v_plan.base_price_monthly end;
  end if;

  if v_sale.id is not null and v_sale.discount_pct is not null then
    v_unit := public.precio_con_descuento(v_unit, v_sale.discount_pct);
  end if;
  v_monto := case
    when v_sale.id is not null and v_sale.discount_pct is null then v_sale.discounted_price
    when v_per_student then v_unit * v_seats
    else v_unit end;
  v_monto := round(coalesce(p_monto, v_monto), 2);
  v_dias := coalesce(v_sale.duration_days, public.dias_de_ciclo(v_ciclo));

  v_license_plan := case when p_plan = 'duo' then 'family_2' when p_plan = 'familia' then 'family_5' else 'individual' end;
  v_code := 'REC-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.receipt_code_seq')::text, 6, '0');
  v_license := public.admin_otorgar_licencia(p_user, v_license_plan, v_seats, v_dias, 'Recibo ' || v_code);

  insert into public.receipts
    (receipt_code, user_id, plan_id, license_id, experiment_id, flash_sale_id, assigned_variant, seats, amount_paid,
     billing_cycle, duration_days, license_starts_at, license_expires_at, notes, issued_by)
  values
    (v_code, p_user, p_plan, v_license, v_experiment, v_sale.id, v_variant, v_seats, v_monto,
     v_ciclo, v_dias, now(), now() + make_interval(days => v_dias), nullif(trim(p_notas), ''), v_admin)
  returning * into v_receipt;

  insert into public.pricing_analytics_events
    (user_id, experiment_id, assigned_variant, event_type, target_role, plan_selected_id, billing_cycle, source)
  values (p_user, v_experiment, v_variant, 'receipt_issued', v_role, p_plan, v_ciclo, 'admin');

  return public.admin_recibo_json(v_receipt);
end;
$$;

-- ═════════════════════════ 6. Permisos ═════════════════════════

revoke execute on function public.precio_con_descuento(numeric, numeric) from public, anon, authenticated;
revoke execute on function public.admin_guardar_oferta(uuid, text, text, text, text, numeric, numeric, integer, timestamptz, timestamptz, boolean) from public, anon;
grant execute on function public.admin_guardar_oferta(uuid, text, text, text, text, numeric, numeric, integer, timestamptz, timestamptz, boolean) to authenticated;

commit;
