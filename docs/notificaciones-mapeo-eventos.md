# Centro de Notificaciones — Mapeo de eventos y preferencias

Investigación previa al diseño del Centro de Notificaciones multicanal (In-App, Push, Email, WhatsApp).
Cada evento está cruzado contra el código actual: **qué lo dispara hoy** (RPC, webhook o tabla) o **qué falta construir** para poder dispararlo.

Fecha: 2026-10-19 · Base: `main` @ 3ecc59d

---

## 0. Lo que ya existe (punto de partida)

| Pieza | Dónde | Estado |
|---|---|---|
| Preferencias de notificación | `profiles.notification_prefs` + `guardar_mis_notificaciones()` (migración `20261004020000`) | Existe. Llaves: `plan`, `racha`, `resultados`, `tutor_resumen`, `novedades`, `hora`. Solo se guardan; **nada las lee para enviar**. |
| Email transaccional | Resend vía `fetch` en `/api/soporte` y `/api/tutor/solicitud` | Existe. Remitente por defecto `onboarding@resend.dev` → hay que verificar dominio propio antes de escalar. |
| Webhook de pagos | `src/app/api/stripe/webhook/route.ts` | Escucha `checkout.session.*`, `invoice.paid`, `customer.subscription.*`. **No escucha `invoice.payment_failed` ni `invoice.upcoming`.** |
| Recibos | `receipts` + `stripe_registrar_pago`, `admin_emitir_recibo` | Existe. |
| App móvil | Capacitor 8 (`@capacitor/core`, `@capacitor/share`) | **Sin** `@capacitor/push-notifications`, sin FCM/APNs. |
| Zona horaria | `hoy_mx()` asume CDMX | No hay zona por usuario (sí hay `pais`). |
| Bandeja In-App / campana | — | No existe. |
| WhatsApp | — | No existe. |

Roles en BD: `user_type` = `student | parent | teacher`, más admin (`is_admin`). El estudiante es Demo o Pro según `get_my_access`.

---

## 1. Tabla de eventos categorizada

**Tipo:** `T` transaccional (no se puede apagar) · `E` enganche (apagable) · `S` segmentada · `M` mercadotecnia (opt-in).
**Canales:** 🔔 In-App · 📱 Push · ✉️ Email · 💬 WhatsApp. En **negrita** el canal principal.
**Trigger:** ✅ existe el punto donde engancharse · 🟡 existe parcialmente · ❌ hay que construirlo.

### 1.1 Pagos, licencias y facturación

| ID | Evento | Trigger en el sistema | Rol objetivo | Tipo | Canales | Estado |
|---|---|---|---|---|---|---|
| P1 | Pago exitoso + recibo | Webhook `invoice.paid` / `checkout.session.completed` → `stripe_registrar_pago` | Pagador (estudiante o padre) | T | **✉️** 🔔 | ✅ |
| P2 | Ficha OXXO/SPEI generada (pendiente de pago) | `checkout.session.completed` con `payment_status = unpaid` | Pagador | T | **✉️** 🔔 | ✅ |
| P3 | Recordatorio: ficha OXXO por expirar | Cron sobre sesiones `unpaid` no liquidadas | Pagador | T | **✉️** 📱 | ❌ |
| P4 | Pago asíncrono fallido | `checkout.session.async_payment_failed` (hoy solo `console.info`) | Pagador | T | **✉️** 🔔 | 🟡 |
| P5 | Tarjeta rechazada en renovación | `invoice.payment_failed` → suscripción `past_due` | Pagador (+ estudiante patrocinado) | T crítica | **✉️** 📱 💬 🔔 | ❌ hay que escuchar el evento |
| P6 | Recibo unificado del padre (varios estudiantes) | Emisión de recibo en planes Tutor/Dúo/Familia | Padre / maestro | T | **✉️** | 🟡 recibo existe, falta agrupar el envío |
| P7 | Vence en 5 días / 1 día (sin renovación automática) | Cron diario sobre `licenses` (fin de vigencia) con `renovacion_automatica = false` | Dueño de la licencia | T | **✉️** 📱 🔔 (💬 el día −1) | ❌ cron |
| P8 | Próximo cargo automático | Webhook `invoice.upcoming` (Stripe, configurable días antes) | Pagador | T | **✉️** | ❌ escuchar evento |
| P9 | Licencia suspendida → pasa a Demo | `customer.subscription.deleted` o vigencia vencida. Hoy el paso a Demo **se calcula al leer** (`get_my_access`), no se registra como evento | Estudiante + patrocinador | T crítica | **🔔** ✉️ 📱 | ❌ cron que detecte la transición |
| P10 | Tutor te asignó un lugar Pro / te lo quitó | `assign_seat`, `activar_lugar_tutor`, `liberar_lugar_tutor` | Estudiante | T | **🔔** 📱 | ✅ |
| P11 | Admin otorgó/editó/quitó licencia | `admin_otorgar_licencia`, `admin_editar_licencia`, `admin_borrar_licencia` | Usuario afectado | T | **🔔** ✉️ | ✅ |
| P12 | Pruebas gratis Demo agotadas | `consumir_prueba_gratis` deja 0 restantes | Estudiante Demo | E (conversión) | **🔔** | ✅ |

### 1.2 Entrenamiento del estudiante

| ID | Evento | Trigger en el sistema | Rol | Tipo | Canales | Estado |
|---|---|---|---|---|---|---|
| E1 | Examen del plan para hoy | Cron a la `hora` de `notification_prefs` sobre `plan_sessions` de hoy sin hacer | Estudiante Pro | E (`plan`) | **📱** 🔔 | ❌ cron; datos ✅ |
| E2 | Sesión de ayer no hecha / reprogramada | `plan_sessions` vencida, `mover_sesion_plan` | Estudiante | E (`plan`) | **🔔** 📱 | ❌ cron |
| E3 | Racha en riesgo (18:00 / 21:00) | Hoy **sin** examen tipo racha en `exam_history`. Hoy los días de racha se calculan en el cliente (`diasDeRacha`) → hay que llevar el cálculo a SQL | Estudiante con racha activa | E (`racha`) | **📱** | ❌ cálculo servidor + cron |
| E4 | Racha rota / nuevo récord | Mismo cálculo que E3 | Estudiante | E (`racha`) | **🔔** | ❌ |
| E5 | Área de oportunidad urgente post-examen | Al cerrar `guardar_examen_libre/plan/racha`: materia con aciertos bajo umbral | Estudiante (+ tutor en resumen) | E (`resultados`) | **🔔** 📱 | ✅ punto de enganche; falta definir umbral. La "Guía de Errores por IA" **no existe**: el enlace iría al resultado |
| E6 | Subiste/bajaste de nivel | `nivel_plan` (85/65), `nivel_racha` | Estudiante | E (`resultados`) | **🔔** | ✅ |
| E7 | Inactivo 3 / 7 días | Cron sobre último `exam_history` | Estudiante | E | **📱** ✉️ | ❌ cron |

### 1.3 Vinculación y familia

| ID | Evento | Trigger en el sistema | Rol | Tipo | Canales | Estado |
|---|---|---|---|---|---|---|
| F1 | El alumno aceptó la invitación | Canje de `invites` (liga de un solo uso) | Tutor | T | **🔔** 📱 ✉️ | ✅ |
| F2 | Invitación sin usar tras N días | Cron sobre `invites` pendientes (`invitaciones_pendientes`) | Tutor | E | **🔔** | ❌ cron |
| F3 | Alumno pidió plan / renovación | `solicitar_plan_tutor` → `/api/tutor/solicitud` (**ya manda email** con `correo_solicitudes_tutor`) | Tutor | T | **✉️** 🔔 📱 💬 | 🟡 falta In-App/Push |
| F4 | Tu tutor atendió tu solicitud | `atender_solicitudes_tutor` | Estudiante | T | **🔔** 📱 | ✅ |
| F5 | Desvinculación por el tutor | `desvincular_estudiante_tutor` | Estudiante (pierde patrocinio → ver P9) | T | **🔔** ✉️ | ✅ |
| F6 | Desvinculación por el alumno | `desvincular_mi_tutor` | Tutor | T | **🔔** ✉️ | ✅ |
| F7 | Resumen semanal del tutor | Cron semanal + `estadisticas_tutor` | Padre / maestro | E (`tutor_resumen`) | **✉️** | ❌ cron; datos ✅ |
| F8 | Alumno sin practicar 3 días | Mismo cálculo que E7 | Tutor | E (`tutor_resumen`) | **🔔** 📱 | ❌ |

### 1.4 Contenido académico e identidad (segmentadas)

| ID | Evento | Trigger en el sistema | Segmento | Tipo | Canales | Estado |
|---|---|---|---|---|---|---|
| C1 | Nuevos reactivos para tu meta | `importar_reactivos` / `lotes_importacion` | Alumnos con `student_goals` en esas carreras (`reactivo_carreras`) | S | **🔔** 📱 | ✅ trigger; agrupar en digest (no uno por lote) |
| C2 | Tu escuela/carrera ya está disponible | Institución pasa de *Próximamente* → *Activa* (PR #35) | Interesados en esa escuela | S | **🔔** ✉️ 📱 | 🟡 el cambio existe; **"Solicitar mi carrera" no existe** → falta lista de espera |
| C3 | Convocatoria / guía oficial actualizada | Broadcast manual del admin | Por institución/carrera | S | **🔔** 📱 | ❌ consola admin |

### 1.5 Docente y escolar

| ID | Evento | Trigger en el sistema | Rol | Tipo | Canales | Estado |
|---|---|---|---|---|---|---|
| D1 | Promedio de grupo < 70 % | Al guardar examen de un alumno del grupo o cron diario sobre `tutor_groups` + `estadisticas_tutor` | Maestro | E | **🔔** ✉️ | ❌ regla; datos ✅ |
| D2 | Evaluación grupal asignada | **No existe** asignar exámenes a un grupo | Estudiante | T | **🔔** 📱 | ❌ requiere la función primero |
| D3 | Alumno del grupo inactivo | Igual que F8 | Maestro | E | **🔔** | ❌ |

### 1.6 Mercadotecnia y retención (broadcast admin)

| ID | Evento | Trigger en el sistema | Segmento | Tipo | Canales | Estado |
|---|---|---|---|---|---|---|
| M1 | Oferta flash activa | `admin_guardar_oferta` / `flash_sales` en curso (`oferta_en_curso`) | Demo, por rol (`rol_de_precio`) y **misma variante A/B** que ve el usuario | M | **📱** ✉️ 🔔 | ✅ trigger |
| M2 | Nueva funcionalidad | Broadcast manual | Global o por rol | M (`novedades`) | **🔔** ✉️ | ❌ consola admin |
| M3 | Campaña Demo (N exámenes usados) | `demo_campaign_config` + conteo de pruebas | Demo | M | **🔔** ✉️ | 🟡 |
| M4 | Reactivación (14/30 días sin entrar) | Cron | Ex-Pro, Demo inactivos | M | **✉️** | ❌ |

### 1.7 Cuenta y seguridad (área extra, siempre activa)

| ID | Evento | Trigger | Canales | Estado |
|---|---|---|---|---|
| A1 | Bienvenida | `handle_new_user` | **✉️** 🔔 | ✅ |
| A2 | Recuperar contraseña / confirmar correo | Supabase Auth | **✉️** | ✅ ya lo manda Supabase |
| A3 | Cuenta eliminada | `eliminar_mi_cuenta` | **✉️** | ✅ |
| A4 | Admin cambió tu tipo de usuario | `admin_cambiar_tipo_usuario` | **🔔** ✉️ | ✅ |
| A5 | Respuesta de soporte | `/api/soporte` | **✉️** | ✅ |

---

## 2. Estructura de preferencias de usuario

### Principios

1. **Transaccional y seguridad no se apagan** (P*, A*, F1/F3–F6). El usuario solo puede elegir *canal secundario* (p. ej. quitar Push), nunca dejar de recibirlo por email/In-App.
2. **Marketing es opt-in explícito** y se apaga con un solo interruptor, sin tocar lo demás.
3. **Menores de edad** (`edad()` < 18): no reciben marketing; la oferta va al tutor vinculado. WhatsApp solo a mayores o al tutor.
4. **WhatsApp**: requiere opt-in propio (política de Meta) y plantillas preaprobadas → reservado a críticos (P5, P7 día −1, F3).
5. **Email de marketing** lleva enlace de baja de un clic (`List-Unsubscribe`).
6. **Horario de silencio** y zona horaria por usuario (derivada de `pais`, editable).

### Evolución de `profiles.notification_prefs` (v2, retrocompatible)

```json
{
  "v": 2,
  "canales":   { "push": true, "email": true, "whatsapp": false },
  "categorias": {
    "plan":          true,
    "racha":         true,
    "resultados":    true,
    "tutor_resumen": true,
    "contenido":     true,
    "marketing":     false
  },
  "hora": "18:00",
  "silencio": { "desde": "22:00", "hasta": "07:00" },
  "zona": "America/Mexico_City"
}
```

- Las llaves actuales (`plan`, `racha`, `resultados`, `tutor_resumen`, `hora`) se conservan; `novedades` se renombra a `marketing` en la migración.
- `pagos`, `cuenta` y `familia` **no aparecen**: no son configurables.
- `guardar_mis_notificaciones` sigue validando solo llaves conocidas.

### Regla de decisión al enviar

```
enviar(usuario, evento, canal) =
    canal habilitado por el sistema para ese evento
  ∧ (evento.critico  ∨ categorias[evento.categoria])
  ∧ (evento.critico ∧ canal ∈ {email, in_app}  ∨ canales[canal])
  ∧ (canal ≠ whatsapp ∨ opt-in WhatsApp)
  ∧ (evento.tipo ≠ marketing ∨ (mayor de edad ∧ categorias.marketing))
  ∧ fuera de silencio (si no es crítico; si cae dentro, se pospone)
  ∧ bajo el tope de frecuencia (máx. 1 marketing/día, 3 push/día)
  ∧ no enviado antes con la misma clave de deduplicación
```

---

## 3. Propuesta técnica (para la siguiente junta)

**Tablas**

| Tabla | Para qué |
|---|---|
| `notification_events` | Catálogo: `codigo` (P5, E3…), `categoria`, `tipo`, `critico`, `canales_default`, plantilla por canal |
| `notifications` | Bandeja In-App: `user_id`, `evento`, `titulo`, `cuerpo`, `url`, `leida_at`, `dedupe_key` única |
| `notification_deliveries` | Un renglón por canal: `estado` (pendiente/enviado/falló/omitido), `proveedor_id`, `motivo_omision` |
| `push_tokens` | Tokens FCM/APNs por dispositivo |

**Flujo**

1. Un solo punto de entrada `notificar(p_user, p_evento, p_datos, p_dedupe)` que llaman los RPCs existentes y el webhook.
2. Inserta en `notifications` (la campana lo muestra al instante) y crea `notification_deliveries` según la regla de la sección 2.
3. Un despachador (Edge Function o cron de Vercel) envía Email (Resend), Push (FCM) y WhatsApp (Cloud API) y marca el resultado.
4. Los eventos programados (E1, E3, P7, F7…) salen de `pg_cron` llamando a `notificar`.

**Huecos detectados que hay que cerrar antes**

- Escuchar `invoice.payment_failed` e `invoice.upcoming` en el webhook.
- Registrar la transición Pro → Demo (hoy solo se calcula al leer).
- Llevar el cálculo de racha a SQL.
- Zona horaria por usuario (hoy todo es `hoy_mx()`).
- Instalar `@capacitor/push-notifications` y configurar FCM/APNs.
- Verificar dominio propio en Resend.
- Funciones que no existen y de las que dependen eventos: "Solicitar mi carrera" (C2), asignar evaluación a grupo (D2), Guía de Errores por IA (E5).

**Fases sugeridas**

1. Campana In-App + Email transaccional (P*, F*, A*) + pantalla de preferencias v2.
2. Push (E1, E3, E5, M1) con horario de silencio y topes.
3. WhatsApp solo para críticos (P5, P7 día −1, F3) + segmentadas (C*, D1) + consola de broadcast admin (M2, C3).
