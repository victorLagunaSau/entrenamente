/** Catálogo público (solo lo activo): lo que ven registro, landing, metas y panel del tutor. */

export type AreaCatalogo = {
  id: string;
  institucionId: string;
  /** A1, A2… */
  codigo: string;
  nombre: string;
  orden: number;
};

export type CarreraCatalogo = {
  id: string;
  institucionId: string;
  areaId: string | null;
  nombre: string;
  orden: number;
  /** false → "Próximamente" (sin reactivos todavía). null → no se sabe (falta la migración catalogo_publico). */
  conReactivos: boolean | null;
};

export type CatalogoData = {
  areas: AreaCatalogo[];
  carreras: CarreraCatalogo[];
};
