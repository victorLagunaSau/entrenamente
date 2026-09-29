-- Entrena Mente · Home Padre / Maestro: periodo de prueba de cada estudiante.
--
-- Se corre DESPUÉS de 20260929000000_home_tutor.sql (ya aplicada).
-- Pegar completo en Supabase → SQL Editor → Run. Todo va en una transacción: si algo falla, no cambia nada.
--
-- Qué cambia:
--   · panel_tutor(): cada estudiante trae ahora su acceso ('tutor' = cupo del tutor, 'otra' = otra licencia,
--     'prueba' = periodo gratis vigente con exámenes disponibles, 'inactivo') y su periodo de prueba
--     (registro, fin de los 15 días, exámenes gratis otorgados y usados). Así el padre que aún no paga ve el
--     contador del hijo desde su registro y lo que ya entrenó.
--   · Sin tablas nuevas ni permisos nuevos: misma función, mismo contrato + campos.

begin;

create or replace function public.panel_tutor()
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_uid uuid := public.exigir_tutor();
  v_lic public.licenses := public.licencia_tutor(v_uid);
  v_vigente boolean := v_lic.id is not null and v_lic.status = 'active' and v_lic.expires_at > now();
begin
  return jsonb_build_object(
    'licencia', case when v_lic.id is null then null else jsonb_build_object(
      'id', v_lic.id,
      'plan', v_lic.plan,
      'cupos', v_lic.seats,
      'usados', (select count(*) from public.license_seats s where s.license_id = v_lic.id and s.released_at is null),
      'origen', v_lic.source,
      'vigente', v_vigente,
      'inicia', v_lic.starts_at,
      'vence', v_lic.expires_at,
      'renovacion_automatica', v_lic.source = 'stripe' and v_lic.stripe_subscription_id is not null
    ) end,
    'grupos', coalesce((
      select jsonb_agg(jsonb_build_object('id', g.id, 'nombre', g.name) order by lower(g.name))
      from public.tutor_groups g where g.owner_id = v_uid
    ), '[]'::jsonb),
    'estudiantes', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id,
        'alias', p.alias,
        'nombre', p.full_name,
        'grupo_id', t.group_id,
        'vinculado', t.linked_at,
        'registrado', p.created_at,
        'universidad_id', g.university_id,
        'carrera_id', g.career_id,
        'carrera', c.nombre,
        'universidad', i.clave,
        'activo', a.tutor,
        'acceso', case
          when a.tutor then 'tutor'
          when a.otra then 'otra'
          when sp.free_trial_ends_at > now() and sp.free_exams_used < sp.free_exams_granted then 'prueba'
          else 'inactivo'
        end,
        'prueba', case when sp.user_id is null then null else jsonb_build_object(
          'termina', sp.free_trial_ends_at,
          'otorgadas', sp.free_exams_granted,
          'usadas', sp.free_exams_used
        ) end
      ) order by lower(p.alias))
      from public.tutor_students t
      join public.profiles p on p.id = t.student_id
      left join public.student_profiles sp on sp.user_id = p.id
      left join lateral (
        select sg.university_id, sg.career_id from public.student_goals sg
        where sg.user_id = p.id order by sg.is_initial desc, sg.created_at limit 1
      ) g on true
      left join public.carreras c on c.id = g.career_id
      left join public.instituciones i on i.id = c.institucion_id
      -- tutor = ocupa un cupo vigente de este tutor; otra = tiene acceso vigente por otra licencia.
      cross join lateral (
        select
          coalesce(bool_or(l.owner_id = v_uid), false) as tutor,
          coalesce(bool_or(l.owner_id <> v_uid), false) as otra
        from public.license_seats s join public.licenses l on l.id = s.license_id
        where s.student_id = p.id and s.released_at is null and l.status = 'active' and l.expires_at > now()
      ) a
      where t.owner_id = v_uid
    ), '[]'::jsonb)
  );
end;
$$;

commit;
