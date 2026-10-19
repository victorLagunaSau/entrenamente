-- Bienvenida automática para todos y limpieza de la bandeja.
-- · Bienvenida (A1) según el tipo de usuario, con saludo neutro y su apodo. Es el primer aviso de cada cuenta nueva
--   y se manda hoy a todas las cuentas que aún no la tienen (sin aviso flotante: aparece en la campana como no leída).
-- · La bandeja no crece para siempre: limpiar_notificaciones() borra las leídas con más de 30 días y cualquiera
--   con más de 90 (sus entregas se van en cascada). Corre todos los días con pg_cron.

begin;

-- ═════════════════════════ 1. Texto de la bienvenida ═════════════════════════

create or replace function public.texto_bienvenida(p_user uuid)
returns table (title text, body text, action_url text)
language sql stable security definer set search_path = ''
as $$
  select
    '¡Hola, ' || public.alias_de(p.id) || '! Te damos la bienvenida a Entrena Mente 🎉',
    case p.user_type
      when 'student' then
        'Tu camino a la universidad empieza hoy. Elige tu carrera meta, haz tu primer simulacro y mira cómo subes '
        || 'de nivel cada semana. Aquí te avisaremos de tus exámenes, tus logros y tu plan. ¡Vamos por ese lugar!'
      when 'parent' then
        'Desde aquí acompañas a tus estudiantes: invítalos, activa su plan y sigue su avance semana a semana. '
        || 'Aquí te avisaremos cuando se unan, cuando te pidan algo y de todo lo importante de tu plan.'
      when 'teacher' then
        'Desde aquí das seguimiento a tus grupos: invita a tus estudiantes y mira su avance. '
        || 'Aquí te avisaremos de todo lo importante.'
      else
        'Aquí te avisaremos de todo lo importante de tu cuenta.'
    end,
    case p.user_type when 'student' then '/app/student' when 'admin' then null else '/app/dashboard' end
  from public.profiles p where p.id = p_user
$$;

create or replace function public.notif_bienvenida()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  t record;
begin
  select * into t from public.texto_bienvenida(new.id);
  perform public.notificar(new.id, 'A1', t.title, t.body, t.action_url, 'A1');
  return null;
end;
$$;

-- Las que ya existen (de esta semana) toman el texto nuevo, siguen igual de leídas o no.
update public.notifications n
set title = t.title, body = t.body, action_url = t.action_url
from public.profiles p, lateral public.texto_bienvenida(p.id) t
where n.event_code = 'A1' and n.user_id = p.id;

-- Todas las cuentas que aún no la tienen.
insert into public.notifications (user_id, event_code, title, body, action_url, dedupe_key)
select p.id, 'A1', t.title, t.body, t.action_url, 'A1'
from public.profiles p, lateral public.texto_bienvenida(p.id) t
on conflict (user_id, dedupe_key) do nothing;

-- ═════════════════════════ 2. Limpieza ═════════════════════════

create or replace function public.limpiar_notificaciones()
returns integer
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_n integer;
begin
  delete from public.notifications
  where (read_at is not null and read_at < now() - interval '30 days')
     or created_at < now() - interval '90 days';
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

-- 15:00 UTC = 9:00 en el centro de México.
select cron.schedule('notificaciones-limpieza', '0 15 * * *', 'select public.limpiar_notificaciones()');

-- ═════════════════════════ 3. Permisos ═════════════════════════

revoke execute on function public.texto_bienvenida(uuid) from public, anon, authenticated;
revoke execute on function public.notif_bienvenida() from public, anon, authenticated;
revoke execute on function public.limpiar_notificaciones() from public, anon, authenticated;
grant execute on function public.limpiar_notificaciones() to service_role;

commit;
