-- Un estudiante vinculado que tenía acceso con otro plan (el suyo, de Stripe o de otra escuela) se quedaba
-- fuera cuando ese plan vencía, aunque su tutor tuviera un cupo libre: assign_seat solo corre al registrarse
-- o al comprar. Este job lo pasa al cupo libre de su tutor en cuanto su plan vence.
--
-- Solo toma a quien perdió el acceso porque su licencia venció (su lugar sigue sin liberar en una licencia
-- vencida), no a quien su tutor liberó a propósito. A una suscripción de Stripe le da 1 día de gracia para que
-- la renovación llegue antes de moverlo.

create or replace function public.reasignar_cupos_vencidos()
returns integer
language plpgsql volatile security definer set search_path = ''
as $$
declare
  r record;
  v_lic uuid;
  v_n integer := 0;
begin
  for r in
    select t.owner_id, t.student_id
    from public.tutor_students t
    where not exists (
        select 1 from public.license_seats s join public.licenses l on l.id = s.license_id
        where s.student_id = t.student_id and s.released_at is null
          and l.status = 'active' and l.expires_at > now()
      )
      and exists (
        select 1 from public.license_seats s join public.licenses l on l.id = s.license_id
        where s.student_id = t.student_id and s.released_at is null
          and (l.status <> 'active' or l.expires_at <= now())
          and not (l.stripe_subscription_id is not null and l.status = 'active' and l.expires_at > now() - interval '1 day')
      )
    order by t.linked_at
  loop
    v_lic := public.licencia_vigente_tutor(r.owner_id);
    -- assign_seat revisa que haya lugar libre y libera el lugar de la licencia vencida.
    if v_lic is not null and public.assign_seat(v_lic, r.student_id) then
      v_n := v_n + 1;
    end if;
  end loop;
  return v_n;
end;
$$;

revoke execute on function public.reasignar_cupos_vencidos() from public, anon, authenticated;

-- Cada hora. Volver a correr la migración no duplica el job.
select cron.schedule('cupos-tutor-al-vencer', '7 * * * *', 'select public.reasignar_cupos_vencidos()');
