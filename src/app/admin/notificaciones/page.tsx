import type { Metadata } from "next";

import { NotificacionesWorkspace } from "@/features/admin/components/notificaciones-workspace";

export const metadata: Metadata = { title: "Notificaciones" };

export default function AdminNotificacionesPage() {
  return <NotificacionesWorkspace />;
}
