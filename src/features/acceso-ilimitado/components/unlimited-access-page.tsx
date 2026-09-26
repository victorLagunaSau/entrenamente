/**
 * Módulo independiente: desbloqueo del acceso ilimitado (pago). Se llega desde el final
 * del registro («Desbloquear acceso ilimitado»); no aparece en ninguna navegación.
 */
export function UnlimitedAccessPage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-4 py-12">
      <h1 className="text-3xl font-bold sm:text-4xl">Acceso ilimitado</h1>
    </main>
  );
}
