# Pagos con Stripe — Entrena Mente

Cómo se cobra: **tarjeta** = suscripción que se renueva sola; **OXXO** y **SPEI** = pago de un solo periodo, y 7 días
antes de que venza la web avisa con un botón "Renovar". Precios con **IVA incluido**, iguales a la lista de Supabase
(`20261019000000_precios_stripe.sql`). La oferta del 40 % se queda en la suscripción mientras el usuario siga pagando.

---

## 1. Abrir la cuenta de Stripe (fundadores)

Ve a **stripe.com/mx** → *Empezar ahora*. Con el correo y la contraseña ya puedes usar el **modo de prueba**, sin
datos fiscales. Para cobrar de verdad, Stripe pide **Activar pagos**:

| Dato | Detalle |
|---|---|
| Tipo de negocio | Persona física con actividad empresarial (RESICO sirve) o persona moral |
| RFC | Con actividad de servicios educativos o digitales |
| Identificación | INE o pasaporte vigente del representante (Stripe pide una selfie) |
| Domicilio | Domicilio fiscal en México |
| Cuenta bancaria | CLABE en pesos **a nombre del mismo RFC** |
| Persona moral | Acta constitutiva, poder del representante y socios con 25 % o más |
| Sitio web | `www.entrenamente.io`: precios visibles, términos, aviso de privacidad, política de cancelación y reembolso, correo de contacto |
| Nombre en el estado de cuenta | `ENTRENAMENTE` (máximo 22 caracteres) |

Después, en el Dashboard:

1. **Settings → Payment methods**: activa *Cards*, *OXXO* y *Bank transfers* (SPEI). OXXO y transferencias pueden
   pasar por una revisión adicional.
2. **Settings → Customer emails**: activa *Successful payments* (comprobante por correo) y *Refunds*.
3. **Settings → Billing → Subscriptions and emails**: activa los reintentos automáticos (*Smart Retries*) y el correo
   de tarjeta rechazada.
4. **Settings → Branding**: logo y colores (salen en el formulario de pago y en los correos).

Las claves secretas **no se mandan por chat ni por correo**: se pegan directo en `.env.local` y en Vercel.

## 2. Configurar el entorno de pruebas

1. **Developers → API keys** (modo prueba): copia `pk_test_…` y `sk_test_…` a `.env.local`
   (ver `.env.example`).
2. **Supabase → Project Settings → API Keys**: copia la **Secret key** a `SUPABASE_SECRET_KEY`.
3. Corre la migración `supabase/migrations/20261020000000_stripe_pagos.sql` en el SQL Editor.
4. Crea el catálogo en Stripe (productos, 9 precios, IVA, portal):
   ```bash
   node --env-file=.env.local scripts/stripe-setup.mjs
   ```
   Copia el `STRIPE_TAX_RATE_IVA=txr_…` que imprime a `.env.local`.
5. Webhook local con la CLI de Stripe (`brew install stripe/stripe-cli/stripe`, luego `stripe login`):
   ```bash
   stripe listen --forward-to localhost:3000/api/stripe/webhook
   ```
   Copia el `whsec_…` que imprime a `STRIPE_WEBHOOK_SECRET` y reinicia `npm run dev`.

## 3. Matriz de pruebas (modo prueba)

| # | Caso | Cómo | Resultado esperado |
|---|---|---|---|
| 1 | Tarjeta aprobada | `4242 4242 4242 4242`, fecha futura, CVC cualquiera | Modal se cierra → "¡Listo!"; recibo `REC-…` con `payment_provider = stripe`, licencia vigente, Home Pro |
| 2 | Tarjeta rechazada | `4000 0000 0000 0002` | Stripe muestra el rechazo dentro del modal; no se crea recibo |
| 3 | Autenticación 3D Secure | `4000 0025 0000 3155` | Pide autorizar; al aprobar, igual que el caso 1 |
| 4 | OXXO | Método "Efectivo en OXXO" | Pantalla "Tu ficha está lista" + enlace; en prueba Stripe la marca pagada en segundos → recibo y licencia |
| 5 | SPEI | Método "Transferencia SPEI" | Pantalla con datos de transferencia; en el Dashboard del cliente → *Simulate bank transfer* → recibo y licencia |
| 6 | Variante A / B | Estudiante con variante A intenta `periodo=quarterly` (o B con `monthly`) | "Ese periodo no está disponible para tu cuenta." |
| 7 | Plan Dúo | Padre, mensual | Licencia `family_2`, 2 lugares |
| 8 | Familia de 6 | Padre, anual, 6 estudiantes | Con oferta: $2,262 (6 × $377); licencia `family_5`, 6 lugares |
| 9 | Renovación con tarjeta | `stripe trigger invoice.paid` no sirve (no trae metadata); usar *Test clocks* del Dashboard o avanzar la suscripción | Nuevo recibo, la misma licencia se extiende |
| 10 | Cancelar renovación | Mi cuenta → "Administrar tarjeta o cancelar renovación" | Portal de Stripe; al volver, el plan sigue vigente hasta su fecha y deja de renovarse |
| 11 | Aviso de vencimiento | Pago OXXO/SPEI; en SQL bajar `licenses.expires_at` a 5 días | Banner "Tu acceso ilimitado vence en 5 días" + Renovar en la Home y en el panel |
| 12 | Descuento conservado | Tras el caso 4, desactivar la oferta y renovar el mismo plan y periodo | Cobra el precio con 40 % y dice "Conservas tu 40 %" |
| 13 | Evento repetido | Reenviar el mismo evento desde el Dashboard (*Resend*) | No se duplica el recibo |
| 14 | Ya patrocinado | Estudiante con lugar en la licencia de su tutor intenta pagar | "Ya tienes acceso ilimitado vigente gracias a tu tutor." |

## 4. Producción

1. En Vercel (Production): `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_…`, `STRIPE_SECRET_KEY=sk_live_…`,
   `SUPABASE_SECRET_KEY`.
2. Catálogo real: `node --env-file=.env.production.local scripts/stripe-setup.mjs --live`, y `STRIPE_TAX_RATE_IVA`.
3. **Developers → Webhooks → Add endpoint**: `https://<dominio>/api/stripe/webhook` con los eventos
   `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`,
   `invoice.paid`, `customer.subscription.created`, `customer.subscription.updated`,
   `customer.subscription.deleted`, `invoice.payment_failed`, `invoice.upcoming` (estos dos últimos: avisos P5 y P8
   del centro de notificaciones). Copia su `whsec_…` a `STRIPE_WEBHOOK_SECRET` y vuelve a desplegar.
4. Compra real de validación (Plan Estudiante mensual con tu tarjeta) y reembolso desde el Dashboard.

Sin `STRIPE_SECRET_KEY` / `SUPABASE_SECRET_KEY` la pantalla de pago muestra "El pago en línea se habilita muy
pronto", como antes.
