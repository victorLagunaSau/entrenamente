import { AuthGuard } from "@/features/auth/components/auth-guard";

export default function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  return <AuthGuard>{children}</AuthGuard>;
}
