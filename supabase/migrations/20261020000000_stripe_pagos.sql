-- Entrena Mente · Pagos con Stripe (tarjeta con renovación automática; OXXO y SPEI por periodo).
--
-- Se corre DESPUÉS de 20261019000000_precios_stripe.sql (ya aplicada).
-- Pegar completo en Supabase → SQL Editor → Run. Todo va en una transacción: si algo falla, no cambia nada.
--
-- Qué agrega:
--   · receipts: de dónde vino el pago (admin / stripe), método (card / oxxo / spei), renovación automática e IDs de Stripe
--     (la sesión y la factura son únicas: un mismo evento repetido nunca emite dos recibos).
--   · stripe_customers (usuario ↔ cliente de Stripe), stripe_subscriptions (estado de cada suscripción con tarjeta)
--     y stripe_events (eventos del webhook ya procesados).
--   · stripe_cotizar(...): lo que debe cobrarse, con las mismas reglas de admin_emitir_recibo (variante A/B, oferta
--     vigente, Familia por estudiante). La oferta por porcentaje se conserva mientras el usuario siga pagando.
--   · stripe_registrar_pago(...): crea o extiende la licencia (source 'stripe'), inserta el recibo y el evento.
--   · stripe_guardar_suscripcion(...): estado de la suscripción (activa, cancelada al final del periodo, terminada).
--   · mi_renovacion(): para el aviso "tu acceso vence en N días" (OXXO / SPEI, sin renovación automática).
--
-- stripe_* solo las llama el servidor (service role); mi_renovacion la llama cualquier usuario con sesión.

begin;

-- ═════════════════════════ 1. Tablas ═════════════════════════

alter table public.receipts
  add column payment_provider varchar(20) not null default 'admin' check (payment_provider in ('admin', 'stripe')),
  add column payment_method varchar(20) check (payment_method in ('card', 'oxxo', 'spei')),
  add column auto_renew boolean not null default false,
  add column stripe_checkout_session_id text unique,
  add column stripe_invoice_id text unique,
  add column stripe_payment_intent_id text,
  add column stripe_subscription_id text;

create table public.stripe_customers (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  customer_id text not null unique,
  created_at timestamptz not null default now()
);

create table public.stripe_subscriptions (
  id text primary key,                                   -- sub_…
  user_id uuid not null references public.profiles(id) on delete cascade,
  license_id uuid references public.licenses(id) on delete set null,
  plan_id varchar(50) not null,
  billing_cycle public.billing_interval not null,
  seats int not null default 1,
  status text not null,                                  -- active, past_due, canceled, incomplete…
  cancel_at_period_end boolean not null default false,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index stripe_subscriptions_user_idx on public.stripe_subscriptions (user_id);

create trigger stripe_subscriptions_touch before update on public.stripe_subscriptions
  for each row execute function public.touch_updated_at();

create table public.stripe_events (
  id text primary key,                                   -- evt_…
  type text not null,
  received_at timestamptz not null default now()
);

alter table public.stripe_customers enable row level security;
alter table public.stripe_subscriptions enable row level security;
alter table public.stripe_events enable row level security;
revoke all on public.stripe_customers, public.stripe_subscriptions, public.stripe_events from anon, authenticated;

-- ═════════════════════════ 2. Cotización ═════════════════════════

-- Suscripción con tarjeta que sigue renovándose (no cancelada) para una licencia.
create or replace function public.renovacion_automatica(p_license uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.stripe_subscriptions s
    where s.license_id = p_license and s.status in ('active', 'trialing', 'past_due') and not s.cancel_at_period_end
  )
$$;

-- Lo que debe cobrarse. Errores con mensaje listo para mostrarse (errcode 22023 / P0002).
--   unit_regular: precio normal por unidad (por estudiante en Familia; el plan completo en los demás).
--   unit_price:   precio a cobrar por unidad (con la oferta, redondeado a pesos).
--   quantity:     estudiantes en Familia; 1 en los demás. total = unit_price × quantity.
--   one_time_only: ofertas de precio fijo (un solo periodo): no se cobran como suscripción.
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

  -- Precio normal por unidad.
  if v_plan.target_role = 'student' then
    select * into v_exp from public.ab_experiments where id = v_experiment;
    if v_exp.id is not null then
      select o.value into v_offer
      from jsonb_array_elements(case when v_variant = 'variant_b' then v_exp.variant_b_config else v_exp.variant_a_config end->'offers') o
      where o.value->>'plan_id' = p_plan and o.value->>'interval' = v_ciclo::text
      limit 1;
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
    if v_per_student then
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

-- ═════════════════════════ 3. Registro del pago (webhook) ═════════════════════════

-- p: user_id, plan_id, billing_cycle, seats, amount, duration_days, period_end (suscripciones: fin del periodo pagado),
--    assigned_variant, experiment_id, flash_sale_id, method, auto_renew, session_id, invoice_id, payment_intent_id,
--    subscription_id, customer_id.
-- Idempotente: si ya existe un recibo con esa sesión o esa factura, lo regresa sin tocar nada.
create or replace function public.stripe_registrar_pago(p jsonb)
returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_user uuid := (p->>'user_id')::uuid;
  v_plan text := p->>'plan_id';
  v_ciclo public.billing_interval := (p->>'billing_cycle')::public.billing_interval;
  v_seats integer := greatest(coalesce((p->>'seats')::int, 1), 1);
  v_dias integer := greatest(coalesce((p->>'duration_days')::int, public.dias_de_ciclo(v_ciclo)), 1);
  v_period_end timestamptz := case when p->>'period_end' is not null
    then to_timestamp((p->>'period_end')::bigint) + interval '1 day' end;   -- 1 día de gracia para reintentos
  v_session text := nullif(p->>'session_id', '');
  v_invoice text := nullif(p->>'invoice_id', '');
  v_sub text := nullif(p->>'subscription_id', '');
  v_tipo text;
  v_license public.licenses;
  v_license_plan text;
  v_starts timestamptz := now();
  v_expires timestamptz;
  v_role public.user_target_role;
  v_receipt public.receipts;
  v_code text;
begin
  select * into v_receipt from public.receipts
  where (v_session is not null and stripe_checkout_session_id = v_session)
     or (v_invoice is not null and stripe_invoice_id = v_invoice)
  limit 1;
  if found then
    return to_jsonb(v_receipt);
  end if;

  select user_type into v_tipo from public.profiles where id = v_user;
  if not found then
    raise exception 'El usuario % ya no existe.', v_user using errcode = 'P0002';
  end if;
  select target_role into v_role from public.subscription_plans where id = v_plan;

  -- Licencia a extender: la de la suscripción, o la suya de Stripe con el mismo plan que sigue vigente (o venció hace < 7 días).
  if v_sub is not null then
    select * into v_license from public.licenses where stripe_subscription_id = v_sub for update;
  end if;
  if v_license.id is null then
    select l.* into v_license
    from public.licenses l
    where l.owner_id = v_user and l.source = 'stripe' and l.status = 'active'
      and l.expires_at > now() - interval '7 days'
      and exists (select 1 from public.receipts r where r.license_id = l.id and r.plan_id = v_plan)
    order by l.expires_at desc
    limit 1
    for update;
  end if;

  if v_license.id is not null then
    v_starts := greatest(v_license.expires_at, now());
    v_expires := case when v_period_end > v_starts then v_period_end else v_starts + make_interval(days => v_dias) end;
    update public.licenses
    set expires_at = v_expires,
        seats = greatest(seats, v_seats),
        stripe_customer_id = coalesce(p->>'customer_id', stripe_customer_id),
        stripe_subscription_id = coalesce(v_sub, stripe_subscription_id)
    where id = v_license.id;
  else
    v_expires := coalesce(v_period_end, now() + make_interval(days => v_dias));
    v_license_plan := case when v_plan = 'duo' then 'family_2' when v_plan = 'familia' then 'family_5' else 'individual' end;
    insert into public.licenses (owner_id, plan, seats, source, status, expires_at, stripe_customer_id, stripe_subscription_id)
    values (v_user, v_license_plan, v_seats, 'stripe', 'active', v_expires, p->>'customer_id', v_sub)
    returning * into v_license;

    if v_tipo = 'student' then
      perform public.assign_seat(v_license.id, v_user);
    else
      perform public.assign_seat(v_license.id, t.student_id)
      from public.tutor_students t
      where t.owner_id = v_user
      order by t.linked_at;
    end if;
  end if;

  if v_sub is not null then
    update public.stripe_subscriptions set license_id = v_license.id where id = v_sub;
  end if;

  v_code := 'REC-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.receipt_code_seq')::text, 6, '0');
  insert into public.receipts
    (receipt_code, user_id, plan_id, license_id, experiment_id, flash_sale_id, assigned_variant, seats, amount_paid,
     billing_cycle, duration_days, license_starts_at, license_expires_at, notes, issued_by,
     payment_provider, payment_method, auto_renew, stripe_checkout_session_id, stripe_invoice_id,
     stripe_payment_intent_id, stripe_subscription_id)
  values
    (v_code, v_user, v_plan, v_license.id, nullif(p->>'experiment_id', '')::uuid, nullif(p->>'flash_sale_id', '')::uuid,
     nullif(p->>'assigned_variant', ''), v_seats, round((p->>'amount')::numeric, 2),
     v_ciclo, greatest(ceil(extract(epoch from (v_expires - v_starts)) / 86400)::int, 1), v_starts, v_expires,
     null, null, 'stripe', nullif(p->>'method', ''), coalesce((p->>'auto_renew')::boolean, false), v_session, v_invoice,
     nullif(p->>'payment_intent_id', ''), v_sub)
  returning * into v_receipt;

  insert into public.pricing_analytics_events
    (user_id, experiment_id, assigned_variant, event_type, target_role, plan_selected_id, billing_cycle, source)
  values (v_user, v_receipt.experiment_id, coalesce(v_receipt.assigned_variant, 'variant_a'), 'receipt_issued', v_role,
          v_plan, v_ciclo, 'stripe');

  return to_jsonb(v_receipt);
end;
$$;

-- Estado de una suscripción con tarjeta (alta, cambios, cancelación). Upsert por id.
create or replace function public.stripe_guardar_suscripcion(
  p_id text,
  p_user uuid,
  p_plan text,
  p_ciclo text,
  p_seats integer,
  p_status text,
  p_cancel_at_period_end boolean,
  p_period_end bigint
)
returns void
language sql volatile security definer set search_path = ''
as $$
  insert into public.stripe_subscriptions
    (id, user_id, license_id, plan_id, billing_cycle, seats, status, cancel_at_period_end, current_period_end)
  values (p_id, p_user, (select id from public.licenses where stripe_subscription_id = p_id), p_plan,
          p_ciclo::public.billing_interval, greatest(coalesce(p_seats, 1), 1), p_status,
          coalesce(p_cancel_at_period_end, false), case when p_period_end is not null then to_timestamp(p_period_end) end)
  on conflict (id) do update
  set status = excluded.status,
      seats = excluded.seats,
      cancel_at_period_end = excluded.cancel_at_period_end,
      current_period_end = coalesce(excluded.current_period_end, public.stripe_subscriptions.current_period_end),
      license_id = coalesce(public.stripe_subscriptions.license_id, excluded.license_id)
$$;

-- ═════════════════════════ 4. Aviso de renovación ═════════════════════════

-- La licencia que el usuario paga (no la patrocinada por un tutor): vencimiento, días que faltan, si se renueva sola
-- y con qué plan / periodo / estudiantes renovar (su último recibo).
create or replace function public.mi_renovacion()
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'license_id', l.id,
    'expires_at', l.expires_at,
    'days_left', greatest(ceil(extract(epoch from (l.expires_at - now())) / 86400)::int, 0),
    'auto_renew', public.renovacion_automatica(l.id),
    'source', l.source,
    'plan_id', r.plan_id,
    'billing_cycle', r.billing_cycle,
    'seats', r.seats,
    'payment_method', r.payment_method
  )
  from public.licenses l
  left join lateral (
    select r.plan_id, r.billing_cycle, r.seats, r.payment_method
    from public.receipts r where r.license_id = l.id order by r.created_at desc limit 1
  ) r on true
  where l.owner_id = (select auth.uid()) and l.status = 'active' and l.expires_at > now()
  order by l.expires_at desc
  limit 1
$$;

-- ═════════════════════════ 5. Permisos ═════════════════════════

revoke execute on function public.renovacion_automatica(uuid) from public, anon, authenticated;
revoke execute on function public.stripe_cotizar(uuid, text, text, integer, uuid) from public, anon, authenticated;
revoke execute on function public.stripe_registrar_pago(jsonb) from public, anon, authenticated;
revoke execute on function public.stripe_guardar_suscripcion(text, uuid, text, text, integer, text, boolean, bigint)
  from public, anon, authenticated;
grant execute on function public.stripe_cotizar(uuid, text, text, integer, uuid) to service_role;
grant execute on function public.stripe_registrar_pago(jsonb) to service_role;
grant execute on function public.stripe_guardar_suscripcion(text, uuid, text, text, integer, text, boolean, bigint)
  to service_role;
grant all on public.stripe_customers, public.stripe_subscriptions, public.stripe_events to service_role;

revoke execute on function public.mi_renovacion() from public, anon;
grant execute on function public.mi_renovacion() to authenticated;

commit;
