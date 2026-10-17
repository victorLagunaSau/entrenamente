-- Métricas de ingresos separadas en Normal / Oferta / Total (/admin/revenue-analytics).
--
-- 1. pricing_analytics_events.flash_sale_id: la oferta que estaba en curso cuando se vio o se tocó un plan. La pone la
--    base (registrar_evento_precio), no el navegador. Los eventos viejos se rellenan por fechas.
-- 2. admin_metricas_ab: por variante, ingresos y recibos con oferta, y clics con oferta por plan.
-- 3. admin_ventas_planes: ventas por plan, periodo y variante (Normal / Oferta) para la pestaña de planes.

begin;

-- ═════════════════════════ 1. Oferta en los eventos ═════════════════════════

alter table public.pricing_analytics_events
  add column flash_sale_id uuid references public.flash_sales(id) on delete set null;

-- Oferta en curso para un rol, plan y periodo en un momento dado (la de mayor descuento si hay varias).
create or replace function public.oferta_en_curso(
  p_role public.user_target_role,
  p_plan text,
  p_cycle public.billing_interval,
  p_at timestamptz default now()
)
returns uuid
language sql stable security definer set search_path = ''
as $$
  select f.id
  from public.flash_sales f
  where f.is_active and f.target_role = p_role and f.starts_at <= p_at and p_at <= f.expires_at
    and (f.plan_id is null or p_plan is null or f.plan_id = p_plan)
    and (f.discount_pct is not null or p_cycle is null or f.billing_cycle = p_cycle)
  order by (f.plan_id is not null) desc, f.discount_pct desc nulls first
  limit 1
$$;

-- Relleno: eventos que ocurrieron dentro de la vigencia de una oferta del mismo rol y plan.
update public.pricing_analytics_events e
set flash_sale_id = public.oferta_en_curso(e.target_role, e.plan_selected_id, e.billing_cycle, e.created_at)
where e.flash_sale_id is null and e.target_role is not null;

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
  v_cycle public.billing_interval;
begin
  if p_event not in ('impression', 'click_intent') then
    raise exception 'Evento no permitido.' using errcode = '22023';
  end if;
  if p_role not in ('student', 'parent') then
    raise exception 'Rol no válido.' using errcode = '22023';
  end if;
  v_role := p_role::public.user_target_role;
  v_cycle := case when p_cycle in ('monthly', 'quarterly', 'annual', 'one_time') then p_cycle::public.billing_interval end;

  if v_uid is not null then
    select assigned_pricing_variant into v_variant from public.profiles where id = v_uid;
  end if;
  v_variant := coalesce(v_variant, public.variante_valida(p_variant));
  if v_variant is null then
    raise exception 'Variante no válida.' using errcode = '22023';
  end if;

  insert into public.pricing_analytics_events
    (user_id, visitor_id, experiment_id, assigned_variant, event_type, target_role, plan_selected_id,
     billing_cycle, source, device_type, flash_sale_id)
  values (
    v_uid,
    left(nullif(trim(p_visitor), ''), 64),
    public.experimento_activo(v_role),
    v_variant,
    p_event::public.analytics_event_type,
    v_role,
    left(nullif(trim(p_plan), ''), 50),
    v_cycle,
    left(nullif(trim(p_source), ''), 30),
    case when p_device in ('mobile', 'desktop') then p_device end,
    public.oferta_en_curso(v_role, nullif(trim(p_plan), ''), v_cycle)
  );
end;
$$;

-- ═════════════════════════ 2. Embudo A/B con Normal / Oferta ═════════════════════════

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
      ) rc
    ),
    'assigned', jsonb_build_object(
      'variant_a', (select count(*) from public.profiles where assigned_pricing_variant = 'variant_a'),
      'variant_b', (select count(*) from public.profiles where assigned_pricing_variant = 'variant_b')
    )
  );
end;
$$;

-- ═════════════════════════ 3. Ventas por plan y periodo ═════════════════════════

-- Recibos no reembolsados, agrupados por plan, periodo y variante, separando los pagados con oferta.
create or replace function public.admin_ventas_planes()
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
      where r.status <> 'refunded'
      group by r.plan_id, r.billing_cycle, r.assigned_variant
    ) x
  ), '[]'::jsonb);
end;
$$;

revoke execute on function public.oferta_en_curso(public.user_target_role, text, public.billing_interval, timestamptz)
  from public, anon, authenticated;
revoke execute on function public.admin_ventas_planes() from public, anon;
grant execute on function public.admin_ventas_planes() to authenticated;

commit;
