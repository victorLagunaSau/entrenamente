-- Aviso de prueba: cada usuario se manda uno desde Configuración → Notificaciones para comprobar la campana
-- (y, cuando haya app, el push del celular). Máximo uno por minuto.

begin;

insert into public.notification_events (code, categoria, critico, canales, descripcion)
values ('T1', 'cuenta', true, '{in_app,push}', 'Aviso de prueba que el usuario se manda desde Configuración')
on conflict (code) do nothing;

create or replace function public.enviarme_aviso_prueba()
returns boolean
language sql volatile security definer set search_path = ''
as $$
  select public.notificar(
    public.exigir_sesion(), 'T1', '¡Tus avisos funcionan!',
    'Así te llegarán los avisos de tu plan, tus pagos y tus estudiantes. Toca aquí para ir a tus preferencias.',
    '/app/cuenta?tab=configuracion',
    'T1:' || to_char(now(), 'YYYYMMDDHH24MI')
  ) is not null
$$;

revoke execute on function public.enviarme_aviso_prueba() from public, anon;
grant execute on function public.enviarme_aviso_prueba() to authenticated;

commit;
