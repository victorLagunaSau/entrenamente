import type { Metadata } from "next";

import { SoportePage } from "@/features/soporte/components/soporte-page";

export const metadata: Metadata = {
  title: "Soporte",
  description: "Preguntas frecuentes y contacto de Entrena Mente.",
};

export default function Page() {
  return <SoportePage />;
}
