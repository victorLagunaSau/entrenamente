import type { Metadata } from "next";

import { ModeGuard } from "@/features/modes/components/mode-guard";
import { PanelShell } from "@/features/modes/components/panel-shell";
import { brandIcons } from "@/lib/brand";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s · Admin" },
  robots: { index: false },
  icons: brandIcons("maestro"),
};

/** Home y herramientas del modo Admin; solo entra user_type = 'admin'. */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <ModeGuard mode="admin">
      <PanelShell>{children}</PanelShell>
    </ModeGuard>
  );
}
