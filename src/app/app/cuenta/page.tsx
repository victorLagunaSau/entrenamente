import type { Metadata } from "next";

import { CuentaPanel } from "@/features/cuenta/components/cuenta-page";

export const metadata: Metadata = { title: "Mi cuenta" };

export default function CuentaPage() {
  return <CuentaPanel />;
}
