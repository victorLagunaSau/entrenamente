-- Recibos en el admin con los datos del pago en Stripe.
-- 1) admin_recibo_json agrega la oferta aplicada (título y %), para mostrar la clave de pago (EST-M-40).
-- 2) admin_buscar_recibos también encuentra por IDs de Stripe: pago (pi_…), factura (in_…), suscripción (sub_…)
--    o sesión (cs_…), como aparecen en el Dashboard de Stripe o en un reclamo del banco.
-- Las columnas de Stripe (payment_provider, payment_method, auto_renew, stripe_*) ya viajan en to_jsonb(r).

create or replace function public.admin_recibo_json(r public.receipts)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select to_jsonb(r) || jsonb_build_object(
    'user', (select jsonb_build_object('id', p.id, 'alias', p.alias, 'email', p.email, 'full_name', p.full_name,
                                       'user_type', p.user_type)
             from public.profiles p where p.id = r.user_id),
    'plan_name', (select name from public.subscription_plans where id = r.plan_id),
    'sale_title', (select f.title from public.flash_sales f where f.id = r.flash_sale_id),
    'discount_pct', (select f.discount_pct from public.flash_sales f where f.id = r.flash_sale_id),
    'vigente', r.status = 'active' and r.license_expires_at > now()
  )
$$;

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
         or v_q in (r.stripe_payment_intent_id, r.stripe_invoice_id, r.stripe_subscription_id,
                    r.stripe_checkout_session_id)
      order by r.created_at desc
      limit 50
    ) r
  ), '[]'::jsonb);
end;
$$;

revoke execute on function public.admin_recibo_json(public.receipts) from public, anon, authenticated;
revoke execute on function public.admin_buscar_recibos(text) from public, anon;
grant execute on function public.admin_buscar_recibos(text) to authenticated;
