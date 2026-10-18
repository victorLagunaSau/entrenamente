-- Pruebas (sandbox de Stripe, localhost) y pagos reales (producción) en la misma base de datos.
--
-- 1. receipts.livemode: true = real, false = prueba. Los pagos de Stripe lo toman del propio evento (livemode);
--    los recibos emitidos en el admin son reales salvo que se marquen como prueba (admin_modo_recibo).
-- 2. stripe_customers por modo: un cliente de prueba y uno real por usuario. Antes había uno solo y una cuenta que pagó
--    en sandbox no podía pagar en producción ("No such customer").
-- 3. Admin: búsqueda de recibos, embudo A/B y ventas por plan muestran solo lo real; p_pruebas = true incluye pruebas.
-- Relleno: la sandbox y la cuenta real son cuentas de Stripe distintas y sus IDs llevan su fragmento
-- (real: QK9MnUTadY). Antes de esta migración el único cliente real es cus_VSjNTpk95csOhD.

begin;

-- ═════════════════════════ 1. Recibos ═════════════════════════

alter table public.receipts add column livemode boolean not null default true;

update public.receipts
set livemode = coalesce(stripe_invoice_id, stripe_payment_intent_id, stripe_checkout_session_id, '') like '%QK9MnUTadY%'
where payment_provider = 'stripe';

create index receipts_livemode_idx on public.receipts (livemode) where not livemode;

-- ═════════════════════════ 2. Clientes de Stripe por modo ═════════════════════════

alter table public.stripe_customers add column livemode boolean not null default false;
update public.stripe_customers set livemode = true where customer_id in ('cus_VSjNTpk95csOhD');
alter table public.stripe_customers drop constraint stripe_customers_pkey;
alter table public.stripe_customers add primary key (user_id, livemode);
alter table public.stripe_customers alter column livemode drop default;

-- ═════════════════════════ 3. Registro del pago con su modo ═════════════════════════

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
     stripe_payment_intent_id, stripe_subscription_id, livemode)
  values
    (v_code, v_user, v_plan, v_license.id, nullif(p->>'experiment_id', '')::uuid, nullif(p->>'flash_sale_id', '')::uuid,
     nullif(p->>'assigned_variant', ''), v_seats, round((p->>'amount')::numeric, 2),
     v_ciclo, greatest(ceil(extract(epoch from (v_expires - v_starts)) / 86400)::int, 1), v_starts, v_expires,
     null, null, 'stripe', nullif(p->>'method', ''), coalesce((p->>'auto_renew')::boolean, false), v_session, v_invoice,
     nullif(p->>'payment_intent_id', ''), v_sub, coalesce((p->>'livemode')::boolean, true))
  returning * into v_receipt;

  insert into public.pricing_analytics_events
    (user_id, experiment_id, assigned_variant, event_type, target_role, plan_selected_id, billing_cycle, source)
  values (v_user, v_receipt.experiment_id, coalesce(v_receipt.assigned_variant, 'variant_a'), 'receipt_issued', v_role,
          v_plan, v_ciclo, 'stripe');

  return to_jsonb(v_receipt);
end;
$$;

-- Marca un recibo como prueba (false) o real (true), p. ej. los emitidos a mano para probar.
create or replace function public.admin_modo_recibo(p_id uuid, p_livemode boolean)
returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_receipt public.receipts;
begin
  perform public.exigir_admin();
  update public.receipts set livemode = p_livemode, updated_at = now() where id = p_id returning * into v_receipt;
  if not found then
    raise exception 'Ese recibo ya no existe.' using errcode = 'P0002';
  end if;
  return public.admin_recibo_json(v_receipt);
end;
$$;

-- ═════════════════════════ 4. Admin: solo lo real, salvo que se pidan las pruebas ═════════════════════════

drop function public.admin_buscar_recibos(text);
drop function public.admin_metricas_ab(uuid);
drop function public.admin_ventas_planes();

create or replace function public.admin_buscar_recibos(p_q text, p_pruebas boolean default false)
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
      where (p_pruebas or r.livemode)
        and (v_q is null
         or r.receipt_code ilike '%' || v_q || '%'
         or p.email ilike '%' || v_q || '%'
         or p.alias ilike '%' || v_q || '%'
         or p.full_name ilike '%' || v_q || '%'
         or v_q in (r.stripe_payment_intent_id, r.stripe_invoice_id, r.stripe_subscription_id,
                    r.stripe_checkout_session_id))
      order by r.created_at desc
      limit 50
    ) r
  ), '[]'::jsonb);
end;
$$;

create or replace function public.admin_metricas_ab(p_experiment uuid default null, p_pruebas boolean default false)
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
        'impressions', ev.impressions,
        'impressions_offer', ev.impressions_offer,
        'visitors', ev.visitors,
        'click_intents', ev.click_intents,
        'click_intents_offer', ev.click_intents_offer,
        'registrations', ev.registrations,
        'receipts', rc.receipts,
        'receipts_offer', rc.receipts_offer,
        'revenue', rc.revenue,
        'revenue_offer', rc.revenue_offer,
        'revenue_normal', rc.revenue - rc.revenue_offer,
        'by_plan', coalesce((
          select jsonb_object_agg(k, n) from (
            select coalesce(e.plan_selected_id, '?') || ':' || coalesce(e.billing_cycle::text, '?') as k, count(*) as n
            from public.pricing_analytics_events e
            where e.experiment_id = v_exp.id and e.assigned_variant = v.variant and e.event_type = 'click_intent'
            group by 1) x), '{}'::jsonb),
        'by_plan_offer', coalesce((
          select jsonb_object_agg(k, n) from (
            select coalesce(e.plan_selected_id, '?') || ':' || coalesce(e.billing_cycle::text, '?') as k, count(*) as n
            from public.pricing_analytics_events e
            where e.experiment_id = v_exp.id and e.assigned_variant = v.variant and e.event_type = 'click_intent'
              and e.flash_sale_id is not null
            group by 1) x), '{}'::jsonb),
        'mobile_share', ev.mobile_share
      ) order by v.variant)
      from (values ('variant_a'), ('variant_b')) v(variant)
      cross join lateral (
        select
          count(*) filter (where e.event_type = 'impression') as impressions,
          count(*) filter (where e.event_type = 'impression' and e.flash_sale_id is not null) as impressions_offer,
          count(distinct coalesce(e.user_id::text, e.visitor_id)) filter (where e.event_type = 'impression') as visitors,
          count(*) filter (where e.event_type = 'click_intent') as click_intents,
          count(*) filter (where e.event_type = 'click_intent' and e.flash_sale_id is not null) as click_intents_offer,
          count(*) filter (where e.event_type = 'conversion_registered') as registrations,
          round(avg(case when e.device_type = 'mobile' then 1 else 0 end) filter (where e.event_type = 'impression'), 3)
            as mobile_share
        from public.pricing_analytics_events e
        where e.experiment_id = v_exp.id and e.assigned_variant = v.variant
      ) ev
      cross join lateral (
        select
          count(*) as receipts,
          count(*) filter (where r.flash_sale_id is not null) as receipts_offer,
          coalesce(sum(r.amount_paid), 0) as revenue,
          coalesce(sum(r.amount_paid) filter (where r.flash_sale_id is not null), 0) as revenue_offer
        from public.receipts r
        where r.experiment_id = v_exp.id and r.assigned_variant = v.variant and r.status <> 'refunded'
          and (p_pruebas or r.livemode)
      ) rc
    ),
    'assigned', jsonb_build_object(
      'variant_a', (select count(*) from public.profiles where assigned_pricing_variant = 'variant_a'),
      'variant_b', (select count(*) from public.profiles where assigned_pricing_variant = 'variant_b')
    )
  );
end;
$$;

create or replace function public.admin_ventas_planes(p_pruebas boolean default false)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform public.exigir_admin();
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'plan_id', x.plan_id,
      'billing_cycle', x.billing_cycle,
      'variant', x.assigned_variant,
      'receipts', x.receipts,
      'receipts_offer', x.receipts_offer,
      'revenue', x.revenue,
      'revenue_offer', x.revenue_offer,
      'revenue_normal', x.revenue - x.revenue_offer
    ) order by x.plan_id, x.billing_cycle, x.assigned_variant)
    from (
      select r.plan_id, r.billing_cycle, r.assigned_variant,
             count(*) as receipts,
             count(*) filter (where r.flash_sale_id is not null) as receipts_offer,
             sum(r.amount_paid) as revenue,
             coalesce(sum(r.amount_paid) filter (where r.flash_sale_id is not null), 0) as revenue_offer
      from public.receipts r
      where r.status <> 'refunded' and (p_pruebas or r.livemode)
      group by r.plan_id, r.billing_cycle, r.assigned_variant
    ) x
  ), '[]'::jsonb);
end;
$$;

revoke execute on function public.stripe_registrar_pago(jsonb) from public, anon, authenticated;
revoke execute on function public.admin_modo_recibo(uuid, boolean) from public, anon;
revoke execute on function public.admin_buscar_recibos(text, boolean) from public, anon;
revoke execute on function public.admin_metricas_ab(uuid, boolean) from public, anon;
revoke execute on function public.admin_ventas_planes(boolean) from public, anon;
grant execute on function public.admin_modo_recibo(uuid, boolean) to authenticated;
grant execute on function public.admin_buscar_recibos(text, boolean) to authenticated;
grant execute on function public.admin_metricas_ab(uuid, boolean) to authenticated;
grant execute on function public.admin_ventas_planes(boolean) to authenticated;

commit;
