import type { Metadata } from "next";

import { UsersWorkspace } from "@/features/admin/components/users-workspace";

export const metadata: Metadata = { title: "Usuarios" };

export default function AdminUsersPage() {
  return <UsersWorkspace />;
}
