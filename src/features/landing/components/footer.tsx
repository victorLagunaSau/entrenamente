import { Logo } from "@/components/layout/logo";

// Sin correo ni teléfono visibles (anti-spam): el contacto es solo por el formulario.
export function Footer() {
  return (
    <footer className="border-t bg-surface-deep">
      <div className="mx-auto flex max-w-7xl flex-col items-center gap-6 px-4 py-10 sm:flex-row sm:justify-between sm:px-6">
        <Logo className="h-8 opacity-90" />
        <nav aria-label="Legal" className="flex items-center gap-3 text-sm text-muted-foreground">
          <a href="#" className="hover:text-foreground">Términos y Condiciones</a>
          <span aria-hidden>|</span>
          <a href="#" className="hover:text-foreground">Aviso de Privacidad</a>
        </nav>
        <p className="text-sm text-muted-foreground">© 2026 Todos los derechos reservados.</p>
      </div>
    </footer>
  );
}
