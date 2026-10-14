-- Saludo sin género: "¡Bienvenido, …!" → "¡Hola, …!" en la bienvenida del Home Demo.
-- Cambia el default y la fila actual (solo reemplaza la palabra; el resto del texto que haya editado el admin se respeta).

alter table public.demo_campaign_config
  alter column titulo_bienvenida set default '¡Hola, {alias}! Diagnostica tu nivel para {carrera}';

update public.demo_campaign_config
set titulo_bienvenida = regexp_replace(titulo_bienvenida, 'Bienvenid[oa]s?', 'Hola', 'g'),
    updated_at = now()
where titulo_bienvenida ~ 'Bienvenid[oa]s?';
