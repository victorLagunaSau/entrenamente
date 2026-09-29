-- Entrena Mente · Plan Estudiante mensual a $97 MXN (así el anual de $950 se nota como ahorro).
--
-- Se corre DESPUÉS de 20260928060000_prueba_periodo_planes.sql (ya aplicada).
-- Pegar completo en Supabase → SQL Editor → Run. Después se puede cambiar desde Admin → Campaña Demo.

begin;

alter table public.demo_campaign_config alter column precio_mensual_mxn set default 97;
update public.demo_campaign_config set precio_mensual_mxn = 97, updated_at = now();

commit;
