-- Asegura la bienvenida en todas las cuentas y ordena el aviso de prueba.
-- · Bienvenida (A1): se crea en las cuentas que aún no la tienen (no duplica las existentes).
-- · Aviso de prueba (T1): cada envío reemplaza al anterior, así no se juntan copias en la campana.
--   Sigue con un máximo de uno por minuto.
-- · Al final muestra una tabla de verificación (cuentas, bienvenidas y trabajos de pg_cron).

begin;

insert into public.notifications (user_id, event_code, title, body, action_url, dedupe_key)
select p.id, 'A1', t.title, t.body, t.action_url, 'A1'
from public.profiles p, lateral public.texto_bienvenida(p.id) t
on conflict (user_id, dedupe_key) do nothing;

create or replace function public.enviarme_aviso_prueba()
returns boolean
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_uid uuid := public.exigir_sesion();
begin
  if exists (
    select 1 from public.notifications
    where user_id = v_uid and event_code = 'T1' and created_at > now() - interval '1 minute'
  ) then
    return false;
  end if;
  delete from public.notifications where user_id = v_uid and event_code = 'T1';
  return public.notificar(
    v_uid, 'T1', '¡Tus avisos funcionan!',
    'Así te llegarán los avisos de tu plan, tus pagos y tus estudiantes. Toca aquí para ir a tus preferencias.',
    '/app/cuenta?tab=configuracion',
    'T1:' || to_char(now(), 'YYYYMMDDHH24MISS')
  ) is not null;
end;
$$;

revoke execute on function public.enviarme_aviso_prueba() from public, anon;
grant execute on function public.enviarme_aviso_prueba() to authenticated;

commit;

-- Verificación: "cuentas" y "con_bienvenida" deben ser iguales; deben salir los dos trabajos de pg_cron.
select
  (select count(*) from public.profiles) as cuentas,
  (select count(distinct user_id) from public.notifications where event_code = 'A1') as con_bienvenida,
  (select string_agg(jobname, ', ' order by jobname) from cron.job where jobname like 'notificaciones-%') as trabajos_cron;
