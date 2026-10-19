"use client";

import * as React from "react";
import { BarChart3, BookOpenCheck, CalendarDays, Compass, Hourglass, UserPlus } from "lucide-react";

import { FloatingChecklist, type GuiaPaso, pedirGuia, useGuiaPedida, useGuiaVista } from "@/features/guia";
import { MenuItem } from "@/features/modes/components/account-menu";
import { useMode } from "@/features/modes/components/mode-guard";

import { GUIA_TUTOR_ERRORES, GUIA_TUTOR_STATS } from "../lib/tutor-guia";
import { getStudentPlans, getTutorExams, type TutorExam } from "../services/tutor-service";
import { InviteDialog } from "./invite-dialog";
import { useTutor } from "./tutor-context";

/** Con más estudiantes que esto, el paso del plan solo revisa a los primeros (una consulta por estudiante). */
const MAX_PLANES = 10;

type Datos = { exams: TutorExam[]; conPlan: boolean };

/** Avance real de la guía del tutor: estudiantes, planes, exámenes y lo que ya revisó. */
function useAvanceTutor() {
  const { viewer } = useMode();
  const { panel } = useTutor();
  const ids = panel?.students.map((s) => s.id).join(",") ?? null;
  const [datos, setDatos] = React.useState<Datos | null>(null);
  const { vista: vioStats } = useGuiaVista(GUIA_TUTOR_STATS, viewer.id);
  const { vista: vioErrores } = useGuiaVista(GUIA_TUTOR_ERRORES, viewer.id);

  React.useEffect(() => {
    if (ids === null) return;
    const lista = ids ? ids.split(",") : [];
    let active = true;
    Promise.all([
      getTutorExams(lista),
      Promise.all(lista.slice(0, MAX_PLANES).map((id) => getStudentPlans(id).catch(() => []))),
    ])
      .then(([exams, planes]) => active && setDatos({ exams, conPlan: planes.some((p) => p.length > 0) }))
      .catch(() => active && setDatos(null));
    return () => {
      active = false;
    };
  }, [ids]);

  if (!panel || !datos || vioStats === null || vioErrores === null) return null;
  const vinculado = panel.students.length > 0;
  const practico = datos.exams.length > 0;
  return {
    hechos: {
      vincular: vinculado,
      plan: datos.conPlan,
      practica: practico,
      seguimiento: practico && vioStats,
      errores: practico && vioErrores,
    },
    ultimo: datos.exams.at(-1) ?? null,
  };
}

export type EstadoGuiaTutor = { pendiente: boolean; avisar: boolean };

/**
 * Guía de configuración del tutor (5 pasos, notificación flotante) + el estado de sus puntos rojos: en «Guía de
 * uso» hasta completar los 5; en el avatar solo hasta que la vea (la cierre o la abra desde el menú).
 */
export function useGuiaTutor() {
  const { viewer } = useMode();
  const { panel, kind, lapsed } = useTutor();
  const avance = useAvanceTutor();
  const { vista: oculta, marcarVista: ocultar } = useGuiaVista("tutor", viewer.id);
  const { vista: abiertaMenu } = useGuiaVista("menu", viewer.id);
  const [invitar, setInvitar] = React.useState(false);

  const completa = !!avance && Object.values(avance.hechos).every(Boolean);
  const estado: EstadoGuiaTutor =
    !avance || oculta === null
      ? { pendiente: false, avisar: false }
      : { pendiente: !completa, avisar: !completa && !(oculta || abiertaMenu) };

  let pasos: GuiaPaso[] = [];
  if (avance && panel) {
    const { hechos, ultimo } = avance;
    const uno = panel.students.length <= 1;
    const quien = uno ? (panel.students[0]?.alias ?? "tu estudiante") : kind === "parent" ? "tus hijos" : "tus alumnos";
    const conLicencia = !!panel.license?.active;
    pasos = [
      {
        id: "vincular",
        icon: UserPlus,
        tone: "secondary",
        title: "Registra o vincula a tu estudiante",
        body: "Para comenzar a monitorear, primero debes vincular a tu estudiante enviándole el enlace de invitación.",
        accion: lapsed ? undefined : { label: "Invitar estudiante", onClick: () => setInvitar(true) },
        hecho: hechos.vincular,
      },
      {
        id: "plan",
        icon: CalendarDays,
        tone: "brand",
        title: "Configura o automatiza el Plan de Prácticas de tu estudiante",
        body: conLicencia
          ? "Configura la fecha límite de su examen oficial y el sistema programará su calendario de práctica."
          : "Configura la fecha límite de su examen oficial y el sistema programará su calendario de práctica. Disponible al activar tu plan.",
        accion: !hechos.vincular
          ? undefined
          : conLicencia
            ? { label: "Ir a sus planes", href: "/app/dashboard" }
            : { label: "Activar mi plan", href: "/app/dashboard/billing" },
        hecho: hechos.plan,
      },
      {
        id: "practica",
        icon: Hourglass,
        tone: "energy",
        title: "Espera a que tu estudiante realice su primera práctica",
        body: hechos.vincular
          ? `Esperando a que ${quien} complete su primer examen…`
          : "En cuanto tu estudiante se vincule, aquí verás cuando complete su primer examen.",
        hecho: hechos.practica,
      },
      {
        id: "seguimiento",
        icon: BarChart3,
        tone: "secondary",
        title: "Inicia el seguimiento del plan (Estadísticas y Línea de Tiempo)",
        body: hechos.practica
          ? "Ya hay datos: revisa sus gráficas, promedios y exporta el reporte para WhatsApp o PDF."
          : "Se desbloquea en cuanto tu estudiante termine su primer examen.",
        accion: hechos.practica ? { label: "Ver estadísticas", href: "/app/dashboard/analytics" } : undefined,
        hecho: hechos.seguimiento,
      },
      {
        id: "errores",
        icon: BookOpenCheck,
        tone: "brand",
        title: "Revisa la Guía de Errores para apoyarlo en sus materias débiles",
        body: ultimo
          ? "Consulta los temas en los que tuvo fallas y la solución explicada paso a paso."
          : "Se desbloquea en cuanto tu estudiante termine su primer examen.",
        accion: ultimo ? { label: "Ver guía de errores", href: `/app/examen-estudiante?id=${ultimo.id}` } : undefined,
        hecho: hechos.errores,
      },
    ];
  }

  // Desde el menú se vuelve a mostrar aunque esté cerrada o completa.
  const [pedida, setPedida] = React.useState(0);
  useGuiaPedida(() => setPedida((n) => n + 1), !!avance);
  const cerrar = () => {
    setPedida(0);
    ocultar();
  };
  const visible = pasos.length > 0 && (pedida > 0 || (oculta === false && !completa));

  const guia = (
    <>
      {visible && (
        <FloatingChecklist title="Guía de configuración tutor" pasos={pasos} sugerido="plan" onDismiss={cerrar} abrir={pedida} />
      )}
      <InviteDialog open={invitar} onOpenChange={setInvitar} />
    </>
  );
  return { estado, guia };
}

/** "Guía de uso" del menú de cuenta del tutor: la guía vive en todo el panel, así que solo se abre. */
export function TutorGuiaMenuItem({ pendiente }: { pendiente: boolean }) {
  const { viewer } = useMode();
  const { marcarVista } = useGuiaVista("menu", viewer.id);
  return (
    <MenuItem
      icon={Compass}
      label="Guía de uso"
      dot={pendiente}
      onClick={() => {
        marcarVista();
        pedirGuia();
      }}
    />
  );
}
