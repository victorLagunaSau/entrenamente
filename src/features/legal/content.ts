/**
 * Textos legales PROVISIONALES: estructura según la LFPDPPP (México), pendientes de revisión
 * por un abogado. Los datos entre corchetes se reemplazan con los reales.
 *
 * Al publicar una versión nueva, cambia PRIVACY_VERSION: cada usuario guarda la versión que
 * aceptó (profiles.privacy_version) y así se sabe a quién pedirle aceptar de nuevo.
 */

export const PRIVACY_VERSION = "2026-09-provisional";
export const LEGAL_UPDATED_AT = "25 de septiembre de 2026";

export type LegalSection = { title: string; paragraphs: string[]; items?: string[] };

export const PRIVACY_SECTIONS: LegalSection[] = [
  {
    title: "Responsable de tus datos",
    paragraphs: [
      "[Razón social], con domicilio en [domicilio fiscal] («Entrena Mente»), es responsable del tratamiento de tus datos personales conforme a la Ley Federal de Protección de Datos Personales en Posesión de los Particulares.",
    ],
  },
  {
    title: "Datos que recabamos",
    paragraphs: ["Al registrarte y usar la plataforma podemos tratar:"],
    items: [
      "Identificación: nombre completo, apodo y, si la agregas, foto de perfil.",
      "Contacto y acceso: correo electrónico y contraseña (guardada cifrada; nadie en Entrena Mente puede verla).",
      "Académicos: escuela de procedencia, universidad y carrera a las que aspiras, resultados de simulacros y avance.",
      "Uso de la plataforma: fechas de acceso, dispositivo y navegador.",
    ],
  },
  {
    title: "Para qué los usamos",
    paragraphs: ["Finalidades necesarias para darte el servicio:"],
    items: [
      "Crear y administrar tu cuenta.",
      "Armar tu plan de entrenamiento y medir tu avance.",
      "Mostrar tu avance a tu madre, padre, tutor o escuela cuando ellos patrocinan tu acceso.",
      "Procesar pagos, cupones y licencias.",
    ],
  },
  {
    title: "Finalidades adicionales",
    paragraphs: [
      "Con tu permiso, también podemos enviarte novedades y recordatorios de estudio. Puedes negarte en cualquier momento escribiendo a [correo de privacidad]; esto no afecta tu servicio.",
    ],
  },
  {
    title: "Menores de edad",
    paragraphs: [
      "Si eres menor de 18 años, tu madre, padre o tutor debe conocer y aceptar este aviso. Al crear tu cuenta confirmas que cuentas con su consentimiento.",
    ],
  },
  {
    title: "Con quién los compartimos",
    paragraphs: [
      "No vendemos tus datos. Solo los compartimos con proveedores que nos ayudan a operar (hospedaje y base de datos, procesamiento de pagos y envío de correos), obligados a protegerlos, y con quien patrocine tu acceso (padre, tutor o escuela), limitado a tu avance académico.",
    ],
  },
  {
    title: "Tus derechos (ARCO)",
    paragraphs: [
      "Puedes acceder, rectificar, cancelar u oponerte al uso de tus datos, así como revocar tu consentimiento, enviando tu solicitud a [correo de privacidad]. Te responderemos en un máximo de 20 días hábiles.",
    ],
  },
  {
    title: "Cambios a este aviso",
    paragraphs: [
      "Si cambiamos este aviso te lo informaremos en la plataforma y, cuando sea necesario, te pediremos aceptarlo de nuevo.",
    ],
  },
];

export const TERMS_SECTIONS: LegalSection[] = [
  {
    title: "Aceptación",
    paragraphs: [
      "Al crear una cuenta en Entrena Mente aceptas estos términos. Si eres menor de edad, tu madre, padre o tutor también debe aceptarlos.",
    ],
  },
  {
    title: "Tu cuenta",
    paragraphs: [
      "Tu cuenta es personal. Cuida tu contraseña y avísanos si alguien más la usa. Tu historial y resultados son tuyos y se conservan aunque cambie quién paga tu acceso.",
    ],
  },
  {
    title: "Plan gratuito, pagos y licencias",
    paragraphs: [
      "El plan gratuito incluye un número limitado de simulacros. Los planes de pago, paquetes familiares, escolares y cupones dan acceso completo durante el periodo indicado. Si una licencia vence o se cancela, el acceso completo se pausa, pero tu historial se conserva.",
    ],
  },
  {
    title: "Uso adecuado",
    paragraphs: [
      "No copies ni redistribuyas los reactivos, no intentes acceder a cuentas ajenas ni afectes el funcionamiento de la plataforma.",
    ],
  },
  {
    title: "Propiedad intelectual",
    paragraphs: [
      "Los contenidos, reactivos y la marca Entrena Mente pertenecen a [razón social] o a sus licenciantes.",
    ],
  },
  {
    title: "Alcance del servicio",
    paragraphs: [
      "Entrena Mente es una herramienta de preparación y no garantiza tu admisión a ninguna institución. Las marcas de las universidades se usan solo como referencia.",
    ],
  },
  {
    title: "Contacto",
    paragraphs: ["Para dudas sobre estos términos escríbenos a [correo de contacto]."],
  },
];
