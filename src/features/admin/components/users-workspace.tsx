import { Users } from "lucide-react";

import { AdminModule } from "./admin-module";

export function UsersWorkspace() {
  return (
    <AdminModule
      icon={Users}
      eyebrow="/admin/users"
      title="Módulo: Administración de Usuarios y Licencias"
      description="Espacio reservado para el control de usuarios registrados, estado de licencias (Activo/Inactivo) y asignación manual de promociones/cupones."
    />
  );
}
