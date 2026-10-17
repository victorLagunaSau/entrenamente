/** Preguntas frecuentes de /soporte. Sin precios: cambian por variante A/B y ofertas, para eso está /pricing. */

/** Temas del formulario de contacto (el servidor valida contra esta lista). */
export const TOPICS = ["Cuenta y acceso", "Pagos y planes", "Error en una pregunta", "Padres y escuelas", "Otro"] as const;

export type Faq = { q: string; a: string };
export type FaqGroup = { title: string; faqs: Faq[] };

export const FAQ_GROUPS: FaqGroup[] = [
  {
    title: "Cuenta y acceso",
    faqs: [
      {
        q: "Olvidé mi contraseña, ¿cómo entro?",
        a: "En la pantalla de inicio de sesión elige «¿Olvidaste tu contraseña?» y te enviamos un enlace a tu correo para crear una nueva. Revisa también la carpeta de spam.",
      },
      {
        q: "¿Puedo cambiar mis datos, mi escuela o mis carreras meta?",
        a: "Sí. Desde «Mi cuenta» editas tu perfil y país; tus carreras meta las cambias en la sección de carreras de tu inicio.",
      },
      {
        q: "¿Cómo elimino mi cuenta?",
        a: "En «Mi cuenta» → Configuración → Eliminar cuenta. Es definitivo: se borran tu historial y resultados.",
      },
    ],
  },
  {
    title: "Simulacros y entrenamiento",
    faqs: [
      {
        q: "¿Qué incluye el plan gratuito?",
        a: "Un número limitado de simulacros completos con su revisión, para que conozcas la plataforma. Racha diaria y plan de estudio personalizado se desbloquean con un plan de pago.",
      },
      {
        q: "¿Los exámenes son iguales a los de la universidad?",
        a: "Imitan el formato, número de reactivos y distribución de materias de cada examen de admisión, pero son preguntas de práctica. Entrena Mente no garantiza tu admisión.",
      },
      {
        q: "Encontré un error en una pregunta",
        a: "¡Gracias! Escríbenos con el formulario de abajo indicando la materia y el texto de la pregunta para corregirla.",
      },
    ],
  },
  {
    title: "Pagos y planes",
    faqs: [
      {
        q: "¿Qué planes hay y cuánto cuestan?",
        a: "Consulta los planes vigentes para estudiantes, padres y escuelas en la página de precios.",
      },
      {
        q: "¿Cómo cancelo la renovación automática o cambio mi tarjeta?",
        a: "En «Mi cuenta» abre la administración de pagos: ahí cambias la tarjeta, descargas recibos o cancelas la renovación. Conservas el acceso hasta que termine el periodo pagado.",
      },
      {
        q: "Si mi licencia vence, ¿pierdo mi avance?",
        a: "No. El acceso completo se pausa, pero tu historial y resultados se conservan para cuando renueves.",
      },
    ],
  },
  {
    title: "Padres, tutores y escuelas",
    faqs: [
      {
        q: "¿Cómo vinculo a mi hijo o alumno?",
        a: "Desde tu panel genera una invitación por estudiante y compártela; cuando la acepta, ves su avance y su lugar cuenta dentro de tu plan.",
      },
      {
        q: "¿El estudiante ve lo que yo veo?",
        a: "El estudiante entrena con su propia cuenta; tú ves su avance, resultados y constancia, nunca su contraseña.",
      },
    ],
  },
];
