import { BRAND } from "@/lib/brand";
import { publicOrigin } from "@/lib/site";

/** Enlace de invitación del padre/tutor: abre el registro con el código ya puesto. */
export const inviteUrl = (code: string) => `${publicOrigin()}/registro?invite_code=${code}`;

export const INVITE_SUBJECT = `Te invito a entrenar en ${BRAND.name}`;

/** Texto que acompaña al enlace en WhatsApp, correo o el menú de compartir del sistema. */
export const INVITE_TEXT = `¡Hola! Te invito a entrenar para tu examen de admisión en ${BRAND.name}. Crea tu cuenta con este enlace:`;

export const inviteMessage = (url: string) => `${INVITE_TEXT} ${url}`;

export const whatsappHref = (url: string) => `https://wa.me/?text=${encodeURIComponent(inviteMessage(url))}`;

export const mailtoHref = (url: string) =>
  `mailto:?subject=${encodeURIComponent(INVITE_SUBJECT)}&body=${encodeURIComponent(inviteMessage(url))}`;
