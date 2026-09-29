-- Entrena Mente · Home Padre / Maestro: el selector "Modo demo / Plan Familiar" es solo para administradores.
--
-- Se corre DESPUÉS de 20260929030000_tutor_pruebas_reales.sql (ya aplicada).
-- Pegar completo en Supabase → SQL Editor → Run. Todo va en una transacción: si algo falla, no cambia nada.
--
-- Qué cambia:
--   · plan_prueba_tutor(): además del interruptor de app_settings, exige que quien la llama sea administrador
--     (antes cualquier padre o maestro podía activarse el Plan Familiar de prueba).

begin;

create or replace function public.plan_prueba_tutor(p_activar boolean)
returns void
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_uid uuid := public.exigir_tutor();
  v_motivo constant text := 'Prueba con grupo de enfoque';
  v_license uuid;
begin
  if not public.is_admin() then
    raise exception 'Solo los administradores pueden cambiar el modo de prueba.' using errcode = '42501';
  end if;
  if not coalesce((select plan_prueba_tutor from public.app_settings), false) then
    raise exception 'El plan de prueba ya no está disponible.' using errcode = '42501';
  end if;

  if not p_activar then
    -- Vuelve a demo: se borra solo la licencia de prueba (sus lugares se van con ella).
    delete from public.licenses where owner_id = v_uid and source = 'admin' and granted_reason = v_motivo;
    return;
  end if;

  select id into v_license from public.licenses
  where owner_id = v_uid and status = 'active' and expires_at > now()
  order by seats desc limit 1;

  if v_license is null then
    insert into public.licenses (owner_id, plan, seats, source, status, expires_at, granted_reason, authorized_by)
    values (v_uid, 'family_5', 5, 'admin', 'active', now() + interval '30 days', v_motivo, v_uid)
    returning id into v_license;
  end if;

  -- Sus estudiantes vinculados sin acceso vigente ocupan un lugar (hasta llenar la licencia).
  perform public.assign_seat(v_license, t.student_id)
  from public.tutor_students t
  where t.owner_id = v_uid
  order by t.linked_at;
end;
$$;

commit;
