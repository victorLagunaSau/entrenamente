"use client";

import { useRouter } from "next/navigation";
import { School } from "lucide-react";

import { MenuItem } from "@/features/modes/components/account-menu";

import { ADD_CAREER_PATH } from "../services/student-goals-service";

/** "Agregar escuela" del menú de cuenta: abre Mis carreras con el alta (o el muro de pago en Demo). */
export function AddSchoolMenuItem() {
  const router = useRouter();
  return <MenuItem icon={School} label="Agregar escuela" onClick={() => router.push(ADD_CAREER_PATH)} />;
}
