-- Entrena Mente · A/B testing de precios para Padres y Tutores (Tutor, Dúo y Familia).
--
-- Se corre DESPUÉS de 20261022000000_metricas_ofertas.sql.
-- Pegar completo en Supabase → SQL Editor → Run. Todo va en una transacción: si algo falla, no cambia nada.
--
-- Cómo funciona un A/B de padres (ab_experiments con target_role = 'parent', uno activo a la vez):
--   · Cada variante lista { plan_id, interval, price } solo para lo que cambia; interval mensual o anual.
--     Los planes y periodos que no aparecen se cobran al precio base del plan.
--   · En el Plan Familia el precio es POR ESTUDIANTE (total = precio × estudiantes).
--   · Las ofertas por porcentaje se aplican encima del precio de la variante (redondeo por unidad, como hoy).
--
-- Qué cambia:
--   · validar_config_variante: en padres solo mensual / anual; un plan y periodo no se repite en una variante.
--   · stripe_cotizar: los padres pagan el precio de su variante si el A/B activo lo define.
--   · admin_emitir_recibo: el Plan Familia también toma el precio de la variante (Tutor y Dúo ya lo hacían).
-- Mismas firmas: los permisos no cambian.

begin;

-- ═════════════════════════ 1. Validación de variantes ═════════════════════════

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
    if p_role = 'parent' and o->>'interval' not in ('monthly', 'annual') then
      raise exception 'Los planes de padres y tutores son mensuales o anuales.' using errcode = '22023';
    end if;
    if jsonb_typeof(o->'price') <> 'number' or (o->>'price')::numeric < 0 then
      raise exception 'Precio no válido en la oferta %.', o->>'plan_id' using errcode = '22023';
    end if;
  end loop;
  if exists (
    select 1 from jsonb_array_elements(p_config->'offers') x
    group by x->>'plan_id', x->>'interval' having count(*) > 1
  ) then
    raise exception 'Cada plan y periodo va una sola vez por variante.' using errcode = '22023';
  end if;
  return p_config;
end;
$$;

-- ═════════════════════════ 2. Cotización de Stripe ═════════════════════════

create or replace function public.stripe_cotizar(
  p_user uuid,
  p_plan text,
  p_ciclo text,
  p_estudiantes integer default null,
  p_oferta uuid default null
)
returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_profile public.profiles;
  v_plan public.subscription_plans;
  v_ciclo public.billing_interval;
  v_role public.user_target_role;
  v_variant text;
  v_experiment uuid;
  v_exp public.ab_experiments;
  v_offer jsonb;
  v_sale public.flash_sales;
  v_kept boolean := false;
  v_per_student boolean;
  v_seats integer;
  v_unit_regular numeric;
  v_unit numeric;
  v_total numeric;
  v_dias integer;
  v_access record;
begin
  select * into v_profile from public.profiles where id = p_user;
  if not found then
    raise exception 'Tu cuenta ya no existe.' using errcode = 'P0002';
  end if;
  select * into v_plan from public.subscription_plans where id = p_plan and is_active;
  if not found then
    raise exception 'Ese plan ya no está disponible.' using errcode = 'P0002';
  end if;
  if p_ciclo not in ('monthly', 'quarterly', 'annual') then
    raise exception 'Ese periodo no está disponible.' using errcode = '22023';
  end if;
  v_ciclo := p_ciclo::public.billing_interval;

  -- Los admins pueden probar cualquier plan; los demás, solo los de su rol.
  v_role := case when v_profile.user_type = 'admin' then v_plan.target_role else public.rol_de_precio(v_profile.user_type) end;
  if v_plan.target_role <> v_role then
    raise exception 'El % no corresponde a tu tipo de cuenta.', v_plan.name using errcode = '22023';
  end if;

  -- Ya tiene acceso vigente que no es suyo por Stripe con este mismo plan (patrocinado, cupón, admin u otro plan).
  select l.id, l.plan, l.source, l.owner_id, l.expires_at,
         (select r.plan_id from public.receipts r where r.license_id = l.id order by r.created_at desc limit 1) as plan_id
  into v_access
  from public.licenses l
  where l.status = 'active' and l.expires_at > now()
    and (l.owner_id = p_user or exists (
      select 1 from public.license_seats s where s.license_id = l.id and s.student_id = p_user and s.released_at is null))
  order by l.expires_at desc
  limit 1;
  if v_access.id is not null and v_profile.user_type <> 'admin' then
    if v_access.owner_id <> p_user then
      raise exception 'Ya tienes acceso ilimitado vigente gracias a tu tutor.' using errcode = '22023';
    end if;
    if public.renovacion_automatica(v_access.id) then
      raise exception 'Tu plan ya se renueva automáticamente con tu tarjeta.' using errcode = '22023';
    end if;
    if v_access.source <> 'stripe' or v_access.plan_id is distinct from p_plan then
      raise exception 'Ya tienes un plan vigente hasta el %. Podrás contratar otro cuando termine.',
        to_char(v_access.expires_at at time zone 'America/Mexico_City', 'DD/MM/YYYY') using errcode = '22023';
    end if;
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

  -- Oferta de su variante para este plan y periodo (si hay A/B activo para su rol).
  select * into v_exp from public.ab_experiments where id = v_experiment;
  if v_exp.id is not null then
    select o.value into v_offer
    from jsonb_array_elements(case when v_variant = 'variant_b' then v_exp.variant_b_config else v_exp.variant_a_config end->'offers') o
    where o.value->>'plan_id' = p_plan and o.value->>'interval' = v_ciclo::text
    limit 1;
  end if;

  -- Precio normal por unidad.
  if v_plan.target_role = 'student' then
    -- Estudiantes: con A/B solo existen los periodos de su variante.
    if v_exp.id is not null then
      if v_offer is null then
        raise exception 'Ese periodo no está disponible para tu cuenta.' using errcode = '22023';
      end if;
      v_unit_regular := (v_offer->>'price')::numeric;
    elsif v_ciclo = 'quarterly' then
      raise exception 'Ese periodo no está disponible para tu cuenta.' using errcode = '22023';
    else
      v_unit_regular := case when v_ciclo = 'annual' then coalesce(v_plan.base_price_annual, v_plan.base_price_monthly * 12)
                             else v_plan.base_price_monthly end;
    end if;
  else
    if v_ciclo not in ('monthly', 'annual') then
      raise exception 'Los planes de padres y tutores son mensuales o anuales.' using errcode = '22023';
    end if;
    if v_offer is not null then
      -- Padres: el A/B cambia el precio de los planes y periodos que define (en Familia, por estudiante);
      -- los demás conservan el precio base.
      v_unit_regular := (v_offer->>'price')::numeric;
    elsif v_per_student then
      v_unit_regular := case when v_ciclo = 'annual'
        then coalesce(v_plan.base_price_annual, v_plan.base_price_monthly * 12) / v_plan.min_students
        else v_plan.extra_student_price_monthly end;
    else
      v_unit_regular := case when v_ciclo = 'annual' then coalesce(v_plan.base_price_annual, v_plan.base_price_monthly * 12)
                             else v_plan.base_price_monthly end;
    end if;
  end if;
  v_unit_regular := round(v_unit_regular);

  -- Oferta: la de precio fijo solo si la pidió; la de porcentaje vigente se aplica sola.
  if p_oferta is not null then
    select * into v_sale from public.flash_sales f
    where f.id = p_oferta and f.is_active and f.starts_at <= now() and now() <= f.expires_at
      and f.target_role = v_plan.target_role and (f.plan_id is null or f.plan_id = p_plan)
      and (f.discount_pct is not null or f.billing_cycle = v_ciclo);
  end if;
  if v_sale.id is null then
    select * into v_sale from public.flash_sales f
    where f.is_active and f.starts_at <= now() and now() <= f.expires_at and f.discount_pct is not null
      and f.target_role = v_plan.target_role and (f.plan_id is null or f.plan_id = p_plan)
    order by f.discount_pct desc
    limit 1;
  end if;
  -- Sin oferta vigente: conserva el porcentaje de su último pago de este plan y periodo si sigue pagando
  -- (su licencia está vigente o venció hace menos de 7 días).
  if v_sale.id is null then
    select f.* into v_sale
    from public.receipts r
    join public.flash_sales f on f.id = r.flash_sale_id and f.discount_pct is not null
    join public.licenses l on l.id = r.license_id
    where r.user_id = p_user and r.plan_id = p_plan and r.billing_cycle = v_ciclo
      and r.payment_provider = 'stripe' and r.status = 'active'
      and l.expires_at > now() - interval '7 days'
    order by r.created_at desc
    limit 1;
    v_kept := v_sale.id is not null;
  end if;

  if v_sale.id is not null and v_sale.discount_pct is null then
    -- Precio fijo: el monto de la oferta es el total; un solo periodo con sus días.
    v_unit := v_sale.discounted_price;
    v_unit_regular := case when v_per_student then v_unit_regular * v_seats else v_unit_regular end;
    v_seats := case when v_per_student then v_seats else v_plan.min_students end;
    v_total := v_unit;
    v_dias := coalesce(v_sale.duration_days, public.dias_de_ciclo(v_ciclo));
    return jsonb_build_object(
      'plan_id', v_plan.id, 'plan_name', v_plan.name, 'target_role', v_plan.target_role, 'billing_cycle', v_ciclo,
      'seats', v_seats, 'per_student', false, 'quantity', 1, 'unit_regular', v_unit_regular, 'unit_price', v_unit,
      'total', v_total, 'duration_days', v_dias, 'assigned_variant', v_variant, 'experiment_id', v_experiment,
      'flash_sale_id', v_sale.id, 'discount_pct', null, 'discount_kept', false, 'one_time_only', true,
      'sale_title', v_sale.title);
  end if;

  v_unit := case when v_sale.id is not null then public.precio_con_descuento(v_unit_regular, v_sale.discount_pct)
                 else v_unit_regular end;
  v_total := v_unit * case when v_per_student then v_seats else 1 end;
  v_dias := public.dias_de_ciclo(v_ciclo);

  return jsonb_build_object(
    'plan_id', v_plan.id, 'plan_name', v_plan.name, 'target_role', v_plan.target_role, 'billing_cycle', v_ciclo,
    'seats', v_seats, 'per_student', v_per_student, 'quantity', case when v_per_student then v_seats else 1 end,
    'unit_regular', v_unit_regular, 'unit_price', v_unit, 'total', v_total, 'duration_days', v_dias,
    'assigned_variant', v_variant, 'experiment_id', v_experiment, 'flash_sale_id', v_sale.id,
    'discount_pct', v_sale.discount_pct, 'discount_kept', v_kept, 'one_time_only', false, 'sale_title', v_sale.title);
end;
$$;


-- ═════════════════════════ 3. Recibos del admin ═════════════════════════

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

  -- Precio normal por unidad (por estudiante en Familia; el plan completo en los demás): primero el de su variante
  -- si el A/B activo de su rol lo define (estudiantes y padres), si no el del plan.
  select o.value into v_offer
  from public.ab_experiments e,
       jsonb_array_elements(case when v_variant = 'variant_b' then e.variant_b_config else e.variant_a_config end->'offers') o
  where e.id = v_experiment and o.value->>'plan_id' = p_plan and o.value->>'interval' = v_ciclo::text
  limit 1;
  if v_offer is not null then
    v_unit := (v_offer->>'price')::numeric;
  elsif v_per_student then
    v_unit := case v_ciclo
      when 'annual' then coalesce(v_plan.base_price_annual, v_plan.base_price_monthly * 12) / v_plan.min_students
      when 'quarterly' then v_plan.extra_student_price_monthly * 3
      else v_plan.extra_student_price_monthly end;
  else
    v_unit := case
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


commit;
